/* ============================================================
   Centro de Solución Bre-B · Lógica de navegación e interacciones
   ============================================================ */
(function () {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ============================================================
     MAZE · Etiquetado de interacciones + slugs (?pantalla=ruta)
     ------------------------------------------------------------
     1) SLUGS: cada pantalla, popup, menú desplegable o drawer cambia
        la URL (?pantalla=crear-solicitud/..., ?pantalla=consultar-estado/...)
        y el <title>, para que Maze lo registre como una pantalla/proceso
        nuevo y genere su mapa de calor.
        IMPORTANTE (documentación de Maze): "every screen needs its own URL"
        y "Each link should load a new page with its own unique URL" (sitio
        multipágina, no SPA). Por eso:
          · PANTALLAS (MZ.screen) → carga real de página: location.assign()
            a ?pantalla=<ruta>. El snippet de Maze se ejecuta en cada carga
            y registra un paso nuevo + su propio mapa de calor.
          · OVERLAYS (popups, menús, drawer) → solo replaceState, sin recarga,
            para no perder lo diligenciado. Maze no captura overlays en los
            mapas de calor ("only the base page/screen").
          · El estado (tickets creados, filtros, borrador del formulario) se
            guarda en sessionStorage al salir y se restaura al cargar.
          · ?mazenav=spa desactiva la recarga (modo SPA con pushState).
        Verificación: abre la página con ?mazedebug=1 para ver el panel
        de diagnóstico (snippet cargado, URL actual, pantallas registradas).
          MZ.screen(path)  → pantalla nueva (cambia la "base")
          MZ.sub(suffix)   → overlay relativo a la base (popup, menú)
          MZ.overlay(path) → overlay con ruta absoluta (drawer)
          MZ.back()        → vuelve a la ruta base
     2) ETIQUETAS: todo elemento interactivo recibe automáticamente
          id="mz-<ámbito>__<tipo>__<nombre>"   (selector #id para Maze)
          data-maze, data-maze-type, data-maze-hover
        Se aplica al cargar y a todo lo que se renderice después
        (formularios, popups, tabla, drawer) mediante MutationObserver.
        Consola: mazeTagMap() lista todas las etiquetas de la pantalla.
     ============================================================ */
  const MZ = (function () {
    const APP = "Credibanco · Bre-B";
    let base = "crear-solicitud";
    let baseTitle = "Crear solicitud";

    const slug = (s) => String(s == null ? "" : s)
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

    // Estado lógico del dashboard (lo leen los marcadores data-maze-* del <body>)
    const state = { form: "", variant: "" };
    let current = "";            // ruta lógica actual (pantalla + overlay)
    let silent = false;          // true mientras se restaura una ruta desde el historial
    let navHandler = null;
    let booted = false;          // hasta terminar la carga inicial, las pantallas no recargan
    const NAV_MODE = new URLSearchParams(location.search).get("mazenav") === "spa" ? "spa" : "recarga";

    /* ---------- URL: ?pantalla=<ruta> (conserva los demás parámetros, p. ej. los de Maze) ---------- */
    const PARAM = "pantalla";
    function readRoute() {
      const q = new URLSearchParams(location.search).get(PARAM);
      if (q) return q.replace(/^\/+|\/+$/g, "");
      // Compatibilidad con enlaces antiguos #/ruta
      return /^#\/./.test(location.hash) ? location.hash.replace(/^#\/?/, "") : "";
    }
    function buildUrl(path) {
      const params = new URLSearchParams(location.search);
      params.delete(PARAM);
      const rest = params.toString();
      // La barra "/" es válida en la query; se deja sin codificar para que la ruta sea legible en Maze
      return location.pathname + "?" + PARAM + "=" + path.split("/").map(encodeURIComponent).join("/") + (rest ? "&" + rest : "");
    }
    function sameUrl(url) { return location.pathname + location.search === url && !location.hash; }

    /* ---------- Registro de interacciones (separado de la URL) ----------
       Cada evento lleva pantalla, overlay, etiqueta (#id / data-maze) y tipo.
       No se guardan valores escritos por el usuario (solo opciones de listas).
       Salida: window.mazeInteractions (array) y el evento "maze:interaction". */
    const logArr = (window.mazeInteractions = window.mazeInteractions || []);
    function track(type, el, extra) {
      const host = el && el.closest ? el.closest("[data-maze]") : null;
      const entry = Object.assign({
        t: new Date().toISOString(),
        type: type,
        screen: base,
        path: current,
        tag: host ? host.dataset.maze : null,
        id: host ? host.id : null,
        kind: host ? host.dataset.mazeType : null
      }, extra || {});
      logArr.push(entry);
      if (logArr.length > 500) logArr.shift();
      window.dispatchEvent(new CustomEvent("maze:interaction", { detail: entry }));
    }

    // Refleja el estado en el <body> y la cuadrícula (marcadores dinámicos del index)
    function mark(title) {
      document.title = title ? APP + " · " + title : APP;
      const b = document.body;
      b.dataset.mazeScreen = base;
      b.dataset.mazeOverlay = current === base ? "" : (current.indexOf(base + "/") === 0 ? current.slice(base.length + 1) : current);
      b.dataset.mazeView = base.indexOf("consultar-estado") === 0 ? "consultar" : "crear";
      b.dataset.mazeForm = state.form;
      b.dataset.mazeVariant = state.variant;
      const g = document.getElementById("solutionGrid");
      if (g) g.dataset.mazeState = b.dataset.mazeView === "consultar" ? "consulta" : (state.form ? "formulario" : "seleccion");
    }

    // replace=true → no agrega entrada al historial (overlays); false → pantalla nueva
    function put(path, title, replace) {
      current = path;
      mark(title);
      track("screen", null, { to: path, via: silent ? "historial" : "ui" });
      if (silent) return;                     // restaurando: la URL ya es la correcta
      const url = buildUrl(path);
      if (sameUrl(url)) return;
      if (!booted) replace = true;            // carga inicial: solo corrige la URL
      window.dispatchEvent(new CustomEvent("maze:url", { detail: { path: path, url: url, replace: !!replace, mode: NAV_MODE } }));
      if (!replace && NAV_MODE === "recarga") {
        // Pantalla nueva = página nueva (lo que Maze necesita para registrar el paso).
        // Si en el mismo clic se piden varias pantallas, gana la última.
        location.assign(url);
        return;
      }
      // replaceState → cambia la URL sin ensuciar el historial (overlays)
      // pushState    → nueva entrada (solo en modo spa)
      history[replace ? "replaceState" : "pushState"]({ mz: path }, "", url);
    }

    /* ---------- Etiquetador automático ---------- */
    const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="menuitem"], .data-row, .acc-option, .acc-head';
    const BANNERS = '.welcome-hero, .template-note, .empty-state, .consulta-empty';
    const SECTIONS = '.stat-group, .stat, .table-wrap, .pager, .drawer__card, .drawer__dates, .timeline__item, .dropzone, .filters, .search, .consulta__toolbar, .sidebar, .app-header, .welcome-panel, .detail-panel, .detail-content__body';
    const HOVERABLE = 'button, a[href], .acc-option, .acc-head, .data-row, .nav-item, .nav-subitem, .stat, .dropzone, .attach, .notif-item, .dropdown__item, .chip, .filter-btn, .search__btn';

    function typeOf(el) {
      if (el.matches("select")) return "dropdown";
      if (el.matches('input[type="file"]')) return "upload";
      if (el.matches("input, textarea")) return "input";
      if (el.matches(".data-row")) return "table-row";
      if (el.matches(".acc-head, .nav-item--parent, [aria-haspopup]")) return "dropdown-toggle";
      if (el.closest(".modal")) return "popup-action";
      if (el.matches("a")) return "link";
      return "button";
    }

    function labelOf(el) {
      const d = el.dataset;
      let t = d.mazeLabel || el.getAttribute("aria-label") || d.optId || d.template || d.chip || d.download || d.file || d.ticket || d.view || "";
      if (!t && (el.type === "radio" || el.type === "checkbox")) t = (el.name || "") + "-" + (el.value || "");
      if (!t && el.id && el.id.indexOf("mz-") !== 0) t = el.id;
      if (!t && el.matches("input, select, textarea")) {
        const lb = el.id && document.querySelector('label[for="' + el.id + '"]');
        t = (lb && lb.textContent) || el.placeholder || el.name || el.type || "";
      }
      if (!t) t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      if (!t) t = String(el.className || "").split(" ")[0] || el.tagName;
      return slug(t);
    }

    function tag(el, kind) {
      if (el.dataset.maze || el.closest("[data-mz-ignore]")) return;
      const holder = el.closest("[data-mz-scope]");
      const scope = holder ? holder.dataset.mzScope : "app";
      const key = scope + "__" + kind + "__" + labelOf(el);
      el.setAttribute("data-maze", key);
      el.setAttribute("data-maze-type", kind);
      if (!el.id) {
        let id = "mz-" + key, n = 1;
        while (document.getElementById(id)) id = "mz-" + key + "-" + (++n);
        el.id = id;
      }
      if (el.matches(HOVERABLE)) el.setAttribute("data-maze-hover", "true");
    }

    function run(root) {
      root = root || document.body;
      root.querySelectorAll(INTERACTIVE).forEach((el) => tag(el, typeOf(el)));
      root.querySelectorAll(BANNERS).forEach((el) => tag(el, "banner"));
      root.querySelectorAll(SECTIONS).forEach((el) => tag(el, "section"));
      // Opciones de los menús desplegables nativos
      root.querySelectorAll("select").forEach((sel) => {
        sel.querySelectorAll("option").forEach((o) => {
          if (o.dataset.maze) return;
          o.setAttribute("data-maze", (sel.dataset.maze || sel.id) + "__opcion__" + slug(o.value || o.textContent));
          o.setAttribute("data-maze-type", "option");
        });
      });
    }

    return {
      slug,
      readRoute,
      formPath: "crear-solicitud",
      run,
      state,
      track,
      // Pantalla nueva: agrega entrada al historial (opts.replace la sustituye, p. ej. en la carga inicial)
      screen(path, title, opts) { base = path; baseTitle = title || baseTitle; put(base, baseTitle, !!(opts && opts.replace)); },
      // Overlays (popup, menú, drawer): cambian la URL sin crear entradas de historial
      overlay(path, title) { put(path, title, true); },
      sub(suffix, title) { put(base + "/" + suffix, (baseTitle ? baseTitle + " · " : "") + (title || suffix), true); },
      back() { put(base, baseTitle, true); },
      // Restauración desde el historial (Atrás/Adelante): la UI se actualiza sin reescribir la URL
      beginRoute() { silent = true; },
      endRoute() {
        silent = false;
        if (!current) return;
        const url = buildUrl(current);
        if (!sameUrl(url)) history.replaceState({ mz: current }, "", url);   // la URL refleja lo que realmente se muestra
      },
      onNavigate(fn) { navHandler = fn; },
      ready() { booted = true; },
      navMode: NAV_MODE,
      init() {
        // Atrás/Adelante del navegador (pushState no dispara popstate, así que solo llegan cambios del usuario)
        window.addEventListener("popstate", () => { if (navHandler) navHandler(readRoute()); });
        // Enlace antiguo con #/ruta editado a mano
        window.addEventListener("hashchange", () => { if (/^#\/./.test(location.hash) && navHandler) navHandler(readRoute()); });
        run();
        let pending = false;
        new MutationObserver(() => {
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => { pending = false; run(); });
        }).observe(document.body, { childList: true, subtree: true });
        // Refleja la opción elegida en cada desplegable (útil al revisar grabaciones)
        document.addEventListener("change", (e) => {
          if (e.target.matches && e.target.matches("select")) e.target.setAttribute("data-maze-selected", e.target.value);
        });
        // Registro de interacciones: clic, cambio de lista, foco, hover sostenido
        document.addEventListener("click", (e) => track("click", e.target), true);
        document.addEventListener("change", (e) => {
          const t = e.target;
          if (!t.matches) return;
          if (t.matches("select")) track("select", t, { value: t.value });
          else if (t.matches('input[type="file"]')) track("upload", t, { files: t.files ? t.files.length : 0 });
          else if (t.matches('input[type="radio"], input[type="checkbox"]')) track("toggle", t, { value: t.value });
          else if (t.matches("input, textarea")) track("input", t);      // sin guardar lo escrito
        }, true);
        document.addEventListener("focusin", (e) => {
          if (e.target.matches && e.target.matches("input, select, textarea")) track("focus", e.target);
        });
        let hoverEl = null, hoverTimer = null;
        document.addEventListener("mouseover", (e) => {
          const h = e.target.closest ? e.target.closest("[data-maze-hover]") : null;
          if (h === hoverEl) return;
          clearTimeout(hoverTimer);
          hoverEl = h;
          if (h) hoverTimer = setTimeout(() => track("hover", h), 600);   // hover sostenido (≥0,6 s)
        });
        document.addEventListener("mouseout", (e) => {
          if (hoverEl && !(e.relatedTarget && hoverEl.contains(e.relatedTarget))) { clearTimeout(hoverTimer); hoverEl = null; }
        });
        // Utilidad de consola: lista todas las etiquetas de la pantalla actual
        window.mazeTagMap = function () {
          return Array.from(document.querySelectorAll("[data-maze]")).map((e) => ({
            id: e.id, tag: e.dataset.maze, type: e.dataset.mazeType, hover: !!e.dataset.mazeHover, slug: readRoute()
          }));
        };
      }
    };
  })();

  /* ---------- Persistencia entre cargas de página (cada pantalla recarga) ---------- */
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem("breb:" + k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem("breb:" + k, JSON.stringify(v)); } catch (e) {} },
    clear(k) { try { sessionStorage.removeItem("breb:" + k); } catch (e) {} }
  };
  // Tickets (incluye los creados en la sesión)
  (function restoreTickets() {
    const saved = store.get("tickets");
    if (Array.isArray(saved) && saved.length) TICKETS.splice(0, TICKETS.length, ...saved);
  })();

  /* ---------- Estado ---------- */
  let currentView = "crear";       // "crear" | "consultar"
  let activeCategoryId = null;     // categoría de acordeón abierta
  let activeOptionId = null;       // opción seleccionada

  /* ---------- Toast ---------- */
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => (toast.hidden = true), 220);
    }, 2600);
  }

  /* ============================================================
     MODAL · Confirmación y resultado (éxito / error)
     ============================================================ */
  const modal = $("#modal");
  const modalDialog = modal.querySelector(".modal__dialog");
  // HTML base del diálogo estándar (se restaura tras usar el popup de filtros)
  const MODAL_BASE = `
      <div class="modal__icon" id="modalIcon"></div>
      <h2 class="modal__title" id="modalTitle"></h2>
      <p class="modal__text" id="modalText"></p>
      <div class="modal__actions" id="modalActions"></div>`;

  const ICON_WARN = `<svg viewBox="0 0 48 48" width="56" height="56"><circle cx="24" cy="24" r="22" fill="#fdecd3"/><circle cx="24" cy="24" r="14" fill="#f5a623"/><path d="M24 17v8M24 30h.02" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  const ICON_OK   = `<svg viewBox="0 0 48 48" width="56" height="56"><circle cx="24" cy="24" r="21" fill="none" stroke="#16a79a" stroke-width="2"/><path d="M15 24.5l6 6 12-13" fill="none" stroke="#16a79a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_ERR  = `<svg viewBox="0 0 48 48" width="56" height="56"><circle cx="24" cy="24" r="21" fill="none" stroke="#e05757" stroke-width="2"/><path d="M24 15v12M24 32h.02" fill="none" stroke="#e05757" stroke-width="2.8" stroke-linecap="round"/></svg>`;

  function openModal(cfg) {
    modal.classList.remove("modal--filters");
    modalDialog.className = "modal__dialog";
    modalDialog.innerHTML = MODAL_BASE;   // siempre partimos del diálogo estándar
    // Maze: cada popup es una "pantalla" propia (slug + ámbito de etiquetas)
    const mzSlug = cfg.slug || MZ.slug(cfg.title);
    modal.dataset.mzScope = "popup-" + mzSlug;
    modalDialog.id = "mz-popup-" + mzSlug;
    modalDialog.setAttribute("data-maze", "popup__" + mzSlug);
    modalDialog.setAttribute("data-maze-type", "popup");
    MZ.sub(mzSlug, cfg.title);
    modalDialog.querySelector("#modalIcon").innerHTML = cfg.icon || "";
    modalDialog.querySelector("#modalTitle").textContent = cfg.title || "";
    modalDialog.querySelector("#modalText").innerHTML = cfg.text || "";
    const actions = modalDialog.querySelector("#modalActions");
    (cfg.actions || []).forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = a.variant === "ghost" ? "btn-ghost" : "btn-submit";
      btn.textContent = a.label;
      btn.addEventListener("click", a.onClick);
      actions.appendChild(btn);
    });
    modal.hidden = false;
  }
  // silent === true → no vuelve al slug base (se usa cuando se navega a otra pantalla justo después)
  function closeModal(silent) {
    modal.hidden = true;
    modal.classList.remove("modal--filters");
    if (silent !== true) MZ.back();
  }

  // Cerrar con Escape; el overlay NO cierra (para no perder el contexto accidentalmente)
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  /* ============================================================
     HEADER · Dropdowns (notificaciones y perfil)
     ============================================================ */
  function setupDropdown(id) {
    const root = $("#" + id);
    const trigger = root.querySelector("button");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !root.classList.contains("open");
      closeAllDropdowns();
      root.classList.toggle("open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        MZ.sub(root.id === "notifDropdown" ? "menu-notificaciones" : "menu-perfil",
               root.id === "notifDropdown" ? "Menú notificaciones" : "Menú perfil");
      }
    });
    // Evita cerrar al hacer click dentro del panel
    root.querySelector(".dropdown__panel").addEventListener("click", (e) => e.stopPropagation());
  }
  function closeAllDropdowns() {
    const anyOpen = $$(".dropdown.open").length > 0;
    $$(".dropdown.open").forEach((d) => {
      d.classList.remove("open");
      const t = d.querySelector("button");
      if (t) t.setAttribute("aria-expanded", "false");
    });
    if (anyOpen) MZ.back();
  }
  setupDropdown("notifDropdown");
  setupDropdown("profileDropdown");
  document.addEventListener("click", closeAllDropdowns);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllDropdowns(); });

  // Marcar notificaciones como leídas
  $("#markAllRead").addEventListener("click", () => {
    $$(".notif-item--unread").forEach((n) => n.classList.remove("notif-item--unread"));
    $("#notifDot").hidden = true;
    showToast("Notificaciones marcadas como leídas");
  });
  // Items del menú de perfil
  $$("#profileDropdown .dropdown__item").forEach((item) => {
    item.addEventListener("click", () => {
      closeAllDropdowns();
      showToast(item.textContent.trim());
    });
  });

  /* ============================================================
     SIDEBAR · Menús expandibles, item activo y versión móvil
     ============================================================ */
  // Grupos expandibles del sidebar
  $$(".nav-group[data-group]").forEach((group) => {
    const parent = group.querySelector(".nav-item--parent");
    parent.addEventListener("click", () => {
      const open = group.classList.toggle("nav-group--open");
      parent.setAttribute("aria-expanded", String(open));
    });
  });

  // Ítems simples del sidebar (Llaves, Gestión de usuarios, etc.)
  $$(".sidebar .nav-item:not(.nav-item--parent)").forEach((item) => {
    item.addEventListener("click", () => {
      showToast(item.querySelector(".nav-item__label").textContent.trim() + " (demo)");
    });
  });

  // Subítems: Crear solicitud / Consultar estado
  $$(".nav-subitem[data-view]").forEach((sub) => {
    sub.addEventListener("click", () => {
      $$(".nav-subitem[data-view]").forEach((s) => s.classList.remove("nav-subitem--active"));
      sub.classList.add("nav-subitem--active");
      switchView(sub.dataset.view);
      closeMobileSidebar();
    });
  });
  // Subítems informativos (Transacciones)
  $$(".nav-group:not(.nav-group--open) .nav-subitem, .nav-subitem:not([data-view])").forEach((sub) => {
    if (sub.dataset.view) return;
    sub.addEventListener("click", () => showToast(sub.textContent.trim() + " (demo)"));
  });

  // Sidebar móvil
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const menuToggle = $("#menuToggle");
  function openMobileSidebar() {
    sidebar.classList.add("is-open");
    overlay.hidden = false;
    menuToggle.setAttribute("aria-expanded", "true");
    MZ.sub("menu-movil", "Menú móvil");
  }
  function closeMobileSidebar() {
    const wasOpen = sidebar.classList.contains("is-open");
    sidebar.classList.remove("is-open");
    overlay.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    if (wasOpen) MZ.back();
  }
  menuToggle.addEventListener("click", () => {
    sidebar.classList.contains("is-open") ? closeMobileSidebar() : openMobileSidebar();
  });
  overlay.addEventListener("click", closeMobileSidebar);

  /* ============================================================
     ACORDEÓN · Render de categorías y opciones
     ============================================================ */
  const accordion = $("#accordion");

  function renderAccordion() {
    accordion.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const item = document.createElement("div");
      item.className = "acc-item";
      item.dataset.catId = cat.id;

      const optionsHTML = cat.options.map((opt) => `
        <button class="acc-option" data-opt-id="${opt.id}" data-cat-id="${cat.id}">
          <span class="acc-option__bullet" aria-hidden="true"></span>
          <span class="acc-option__text">
            <span class="acc-option__label">${opt.label}</span>
            <span class="acc-option__desc">${opt.desc}</span>
          </span>
        </button>`).join("");

      item.innerHTML = `
        <button class="acc-head" aria-expanded="false">
          <span class="acc-head__icon">${cat.icon}</span>
          <span class="acc-head__label">${cat.label}</span>
          <svg class="acc-head__chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="acc-body">
          <div class="acc-body__inner">${optionsHTML}</div>
        </div>`;

      accordion.appendChild(item);
    });

    // Head: expandir/contraer (solo una abierta a la vez, tipo imagen)
    $$(".acc-head", accordion).forEach((head) => {
      head.addEventListener("click", () => {
        const item = head.closest(".acc-item");
        const willOpen = !item.classList.contains("is-open");
        $$(".acc-item", accordion).forEach((i) => {
          i.classList.remove("is-open");
          i.querySelector(".acc-head").setAttribute("aria-expanded", "false");
        });
        if (willOpen) {
          item.classList.add("is-open");
          head.setAttribute("aria-expanded", "true");
          activeCategoryId = item.dataset.catId;
        } else {
          activeCategoryId = null;
        }
        // Maze: categoría desplegada = pantalla propia (si no hay un formulario abierto)
        if (!activeOptionId) {
          if (willOpen) MZ.screen("crear-solicitud/categoria/" + MZ.slug(item.dataset.catId), "Categoría " + head.textContent.trim());
          else MZ.screen("crear-solicitud", "Crear solicitud");
        }
      });
    });

    // Opciones: seleccionar abre el formulario
    $$(".acc-option", accordion).forEach((btn) => {
      btn.addEventListener("click", () => selectOption(btn.dataset.catId, btn.dataset.optId));
    });
  }

  /* ============================================================
     ACORDEÓN · Chevron lateral (›) de la referencia
     El head apunta a la derecha cuando está cerrado y abajo al abrir.
     Lo logramos con CSS rotate; aquí solo mantenemos estado.
     ============================================================ */

  /* ============================================================
     DETALLE · Selección de opción → formulario "Crea tu solicitud"
     ============================================================ */
  const emptyState   = $("#emptyState");
  const detailContent= $("#detailContent");
  const detailIcon   = $("#detailIcon");
  const detailTitle  = $("#detailTitle");
  const detailSub    = $("#detailSubtitle");
  const detailBody   = $("#detailBody");
  const solutionGrid = $("#solutionGrid");
  const consultaHost = $("#consultaHost");
  const detailPanel  = $("#detailPanel");

  function findOption(catId, optId) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    if (!cat) return null;
    return { cat, opt: cat.options.find((o) => o.id === optId) };
  }

  function markActiveOption(optId) {
    $$(".acc-option", accordion).forEach((b) =>
      b.classList.toggle("is-active", b.dataset.optId === optId)
    );
  }

  function selectOption(catId, optId) {
    const found = findOption(catId, optId);
    if (!found || !found.opt) return;
    activeOptionId = optId;
    markActiveOption(optId);
    renderCreateForm(found.cat, found.opt);
    showDetail();
    closeMobileSidebar();
    // Maze: cada subcategoría/formulario tiene su propio slug
    MZ.state.form = optId;
    MZ.state.variant = "";
    MZ.formPath = "crear-solicitud/" + MZ.slug(catId) + "/" + MZ.slug(optId);
    MZ.screen(MZ.formPath, found.opt.form + " · " + found.opt.label);
  }

  /* ---------- Helpers de render de campos ---------- */
  const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const reqMark = (r) => r ? ` <span class="req">*</span>` : "";

  const SVG_CAL = `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const SVG_UPLOAD = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 15V4m0 0l-4 4m4-4l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const SVG_INFO = `<svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const SVG_CLOCK = `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // Genera el HTML de un campo individual
  function fieldHTML(f) {
    const req = !!f.requerido;
    switch (f.type) {
      case "text":
        return `<div class="field" data-field="${f.id}">
          <label for="f-${f.id}">${esc(f.label)}${reqMark(req)}</label>
          <input type="text" id="f-${f.id}" placeholder="${esc(f.placeholder || "")}" ${f.maxLength?`maxlength="${f.maxLength}"`:""} data-req="${req}" />
          <small class="field-error" data-for="f-${f.id}" hidden>Este campo es obligatorio.</small>
        </div>`;
      case "date":
        return `<div class="field" data-field="${f.id}">
          <label for="f-${f.id}">${esc(f.label)}${reqMark(req)}</label>
          <div class="input-icon">
            <input type="text" id="f-${f.id}" placeholder="DD/MM/AAAA" data-req="${req}" onfocus="(this.type='date')" onblur="if(!this.value)this.type='text'" />
            <span class="input-icon__btn">${SVG_CAL}</span>
          </div>
          <small class="field-error" data-for="f-${f.id}" hidden>Este campo es obligatorio.</small>
        </div>`;
      case "select":
        return `<div class="field" data-field="${f.id}" ${f.showIf?`data-show-if="${f.showIf.field}" data-show-eq="${esc(f.showIf.equals)}" hidden`:""}>
          <label for="f-${f.id}">${esc(f.label)}${reqMark(req)}</label>
          <select id="f-${f.id}" data-req="${req}" ${f.requeridoIf?'data-req-if="true"':''}>
            <option value="">${esc(f.placeholder || "Selecciona una opción")}</option>
            ${f.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}
          </select>
          <small class="field-error" data-for="f-${f.id}" hidden>Selecciona una opción.</small>
        </div>`;
      case "textarea":
        return `<div class="field" data-field="${f.id}">
          <label for="f-${f.id}">${esc(f.label)}${reqMark(req)}</label>
          <textarea id="f-${f.id}" maxlength="${f.maxLength||2000}" placeholder="${esc(f.placeholder || "Describe tu problema para ayudarte a solucionarlo")}" data-req="${req}"></textarea>
          <small class="char-hint">${SVG_INFO} <span class="char-count" data-max="${f.maxLength||2000}">Máximo ${f.maxLength||2000} caracteres</span></small>
          <small class="field-error" data-for="f-${f.id}" hidden>Este campo es obligatorio.</small>
        </div>`;
      case "file":
        return `<div class="field" data-field="${f.id}">
          <label>${esc(f.label)}${reqMark(req)}</label>
          <div class="dropzone" data-dropzone data-max="${f.max||3}" data-accept="${f.accept||""}" data-req="${req}" ${f.scan?'data-scan="true"':''}>
            <input type="file" id="f-${f.id}" class="dropzone__input" ${f.max>1?"multiple":""} accept="${f.accept||""}" hidden />
            <div class="dropzone__top">
              <span class="dropzone__icon">${SVG_UPLOAD}</span>
              <div class="dropzone__info">
                <span class="dropzone__title">File</span>
                <span class="dropzone__meta">Formatos: <b>${esc(f.acceptLabel||"")}</b> &nbsp; Tamaño máximo: <b># MB</b></span>
              </div>
            </div>
            <div class="dropzone__files">
              <ul class="filelist" data-filelist></ul>
              <button type="button" class="dropzone__add" data-add aria-label="Agregar archivo">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
            <div class="dropzone__bar"><span class="dropzone__bar-fill" data-bar></span></div>
          </div>
          <small class="field-error" data-for="f-${f.id}" hidden>Adjunta al menos un archivo.</small>
        </div>`;
      case "template":
        return `<div class="field" data-field="${f.id}">
          <div class="template-note">
            <span class="template-note__icon">${SVG_INFO}</span>
            <div>
              <p>Antes de comenzar descarga el archivo base para el cargue masivo de información, con la estructura y formato requeridos.</p>
              <button type="button" class="template-note__link" data-template="${esc(f.file)}">Descargar plantilla</button>
            </div>
          </div>
        </div>`;
      case "timerange":
        return `<div class="field" data-field="${f.id}">
          <label>${esc(f.label)}${reqMark(req)}</label>
          <div class="timerange" data-timerange data-req="${req}">
            <input type="text" id="f-${f.id}" class="timerange__input" placeholder="HH:MM – HH:MM" readonly data-req="${req}" />
            <span class="input-icon__btn timerange__ic">${SVG_CLOCK}</span>
            <div class="timepop" data-mz-scope="rango-hora" hidden>
              <div class="timepop__row">
                <div class="timepop__col">
                  <span class="timepop__lbl">Hora inicial</span>
                  <div class="timepop__fields">
                    <input type="text" class="timepop__num" data-k="h1" maxlength="2" inputmode="numeric" value="00">
                    <span class="timepop__sep">:</span>
                    <input type="text" class="timepop__num" data-k="m1" maxlength="2" inputmode="numeric" value="00">
                  </div>
                </div>
                <div class="timepop__col">
                  <span class="timepop__lbl">Hora final</span>
                  <div class="timepop__fields">
                    <input type="text" class="timepop__num" data-k="h2" maxlength="2" inputmode="numeric" value="23">
                    <span class="timepop__sep">:</span>
                    <input type="text" class="timepop__num" data-k="m2" maxlength="2" inputmode="numeric" value="59">
                  </div>
                </div>
              </div>
              <div class="timepop__actions">
                <button type="button" class="btn-ghost timepop__cancel">Cancelar</button>
                <button type="button" class="btn-submit timepop__ok">Listo</button>
              </div>
            </div>
          </div>
          <small class="field-error" data-for="f-${f.id}" hidden>Este campo es obligatorio.</small>
        </div>`;
      case "row":
        return `<div class="field-row">${f.fields.map(fieldHTML).join("")}</div>`;
      default:
        return "";
    }
  }

  // Aplana campos (incluye los de dentro de "row") para validar
  function flatten(fields) {
    const out = [];
    fields.forEach(f => f.type === "row" ? out.push(...f.fields) : out.push(f));
    return out;
  }

  function renderCreateForm(cat, opt) {
    detailContent.classList.add("detail-content--form");
    detailIcon.innerHTML = cat.icon;
    detailTitle.textContent = "Crea tu solicitud";
    detailSub.innerHTML = "";          // sin texto de descripción (diseño solicitado)
    detailSub.hidden = true;

    const def = FORMS[opt.form];
    if (!def) {
      detailBody.innerHTML = `<p class="empty-state__text">Formulario no disponible para esta opción.</p>`;
      return;
    }

    detailBody.dataset.mzScope = "form-" + MZ.slug(opt.id);   // ámbito de etiquetas Maze
    const hasVariants = !!def.variants;
    let bodyHTML = "";

    if (hasVariants) {
      const v = def.variants;
      bodyHTML += `<div class="field" data-field="novedad">
        <label for="f-novedad">${esc(v.label)}${reqMark(true)}</label>
        <select id="f-novedad" data-req="true" data-variant-select>
          <option value="">Selecciona una opción</option>
          ${v.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}
        </select>
        <small class="field-error" data-for="f-novedad" hidden>Selecciona una opción.</small>
      </div>
      <div data-variant-container></div>`;
    } else {
      bodyHTML += def.fields.map(fieldHTML).join("");
    }

    detailBody.innerHTML = `
      <form id="solicitudForm" novalidate>
        ${bodyHTML}
        <div class="form-actions">
          <button type="button" class="btn-ghost" id="cancelBtn">Cancelar</button>
          <button type="submit" class="btn-submit">Crear solicitud</button>
        </div>
      </form>`;

    const form = $("#solicitudForm", detailBody);

    // Variantes Unitaria/Masiva
    if (hasVariants) {
      const sel = $("#f-novedad", detailBody);
      const container = $("[data-variant-container]", detailBody);
      sel.addEventListener("change", () => {
        const key = sel.value;
        // Maze: Unitaria / Masiva son pantallas distintas del mismo formulario
        detailBody.dataset.mzScope = "form-" + MZ.slug(opt.id) + (key ? "-" + MZ.slug(key) : "");
        MZ.state.variant = key ? MZ.slug(key) : "";
        MZ.screen(MZ.formPath + (key ? "/" + MZ.slug(key) : ""), opt.form + " · " + opt.label + (key ? " · " + key : ""));
        container.innerHTML = key && def.variants[key]
          ? def.variants[key].map(fieldHTML).join("")
          : "";
        wireFields(container);
        clearError(sel);
      });
    }

    wireFields(detailBody);

    // Cancelar
    $("#cancelBtn", detailBody).addEventListener("click", () => {
      resetDetail();
      MZ.screen("crear-solicitud", "Crear solicitud");
    });

    // Enviar → flujo de confirmación / resultado
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(form)) {            // campos obligatorios primero
        MZ.sub("campos-obligatorios", "Campos obligatorios pendientes");
        return;
      }
      confirmAndSubmit(opt);
    });
  }

  /* ============================================================
     FLUJO · Confirmar → Éxito / Error
     "Regresar" cierra el modal sin tocar el formulario, por lo que
     los datos ya ingresados se conservan intactos.
     ============================================================ */
  function confirmAndSubmit(opt) {
    openModal({
      icon: ICON_WARN,
      slug: "confirmar-envio",
      title: "¿Confirmas la creación de tu solicitud?",
      text: "",
      actions: [
        { label: "Regresar", variant: "ghost", onClick: closeModal },
        { label: "Confirmar", onClick: () => processSubmit(opt) }
      ]
    });
  }

  function processSubmit(opt) {
    // Simulación de respuesta del backend.
    // Para la demo: si "problema/solicitud/descripcion" contiene la palabra
    // "error", se fuerza el caso de fallo; de lo contrario, éxito.
    const txt = ($("#f-problema", detailBody) || $("#f-solicitud", detailBody) || $("#f-descripcion", detailBody) || { value: "" }).value.toLowerCase();
    const success = !txt.includes("error");

    if (success) {
      const ticket = String(Math.floor(10000 + Math.random() * 90000));
      const fecha = estimatedDate();
      // Registra la solicitud en "Consultar estado" con la fecha/hora actual.
      // "Novedad" solo aplica si el formulario tiene variante (select #f-novedad).
      const novedadSel = $("#f-novedad", detailBody);
      const novedad = novedadSel ? novedadSel.value : "";
      const cat = CATEGORIES.find(c => c.options.some(o => o.id === activeOptionId));
      const optObj = cat && cat.options.find(o => o.id === activeOptionId);
      // Recoge los archivos adjuntados en el formulario (para poder re-descargarlos)
      const adjuntos = [];
      $$("[data-dropzone]", detailBody).forEach(z => (z._files || []).forEach(f => adjuntos.push({ name: f.name })));
      TICKETS.unshift({
        ticket,
        creacion: stampFull(),
        vencimiento: stampFull(5),
        estado: "En proceso",
        solicitante: "Ana Buriticá",
        ans: "A tiempo",
        novedad,
        categoria: cat ? cat.label : "Operaciones",
        titulo: optObj ? optObj.label : "Solicitud Bre-B",
        subtitulo: cat ? cat.label : "",
        escalado: "Usuario",
        adjuntos,
        comentarios: [],
        solucion: null
      });
      openModal({
        icon: ICON_OK,
        slug: "solicitud-exitosa",
        title: "Tu solicitud fue creada exitosamente",
        text: `Puedes hacer seguimiento a tu solicitud con el <strong>Ticket #${ticket}</strong> que encontrarás en consultar estado.<br><br>Fecha estimada de solución<br><strong>${fecha}</strong>`,
        actions: [
          { label: "Entendido", onClick: () => {
              closeModal(true);           // la siguiente pantalla (consultar estado) fija el slug
              resetDetail();              // limpia y vuelve al estado inicial
              goToConsultar();            // lleva a "Consultar estado" como en el flujo
          } }
        ]
      });
    } else {
      openModal({
        icon: ICON_ERR,
        slug: "solicitud-con-error",
        title: "Tu solicitud no pudo ser creada",
        text: "Vuelve a intentarlo más tarde",
        actions: [
          // Regresar: cierra el modal y deja el formulario con los datos ya diligenciados
          { label: "Regresar", onClick: closeModal }
        ]
      });
    }
  }

  function estimatedDate() {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  // Marca de fecha/hora completa "AAAA-MM-DD HH:MM:SS" (+n días opcional)
  function stampFull(addDays = 0) {
    const d = new Date();
    if (addDays) d.setDate(d.getDate() + addDays);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // Cambia a la vista "Consultar estado" tras una creación exitosa
  function goToConsultar() {
    const sub = $('.nav-subitem[data-view="consultar"]');
    if (sub) sub.click();
  }

  /* ---------- Conecta comportamiento a los campos renderizados ---------- */
  function wireFields(scope) {
    // Contador de caracteres
    $$("textarea", scope).forEach((ta) => {
      const hint = ta.parentElement.querySelector(".char-count");
      if (!hint) return;
      const max = parseInt(hint.dataset.max, 10);
      ta.addEventListener("input", () => {
        const left = max - ta.value.length;
        hint.textContent = `${left} de ${max} caracteres restantes`;
        clearError(ta);
      });
    });

    // Limpiar error al escribir/cambiar
    $$("input, select", scope).forEach((el) => {
      el.addEventListener("input", () => clearError(el));
      el.addEventListener("change", () => clearError(el));
    });

    // Campos condicionales (p. ej. Estado Devolución según Tipo de operación)
    $$("[data-show-if]", scope).forEach((field) => {
      const srcId = field.dataset.showIf;
      const eq = field.dataset.showEq;
      const src = $("#f-" + srcId, scope) || $("#f-" + srcId, detailBody);
      if (!src) return;
      const toggle = () => { field.hidden = src.value !== eq; };
      src.addEventListener("change", toggle);
      toggle();
    });

    // Descargar plantilla (demo)
    $$("[data-template]", scope).forEach((btn) => {
      btn.addEventListener("click", () => showToast(`Descargando plantilla: ${btn.dataset.template}`));
    });

    // Zonas de carga de archivos (drag & drop + click)
    $$("[data-dropzone]", scope).forEach(setupDropzone);

    // Selector de rango de hora
    $$("[data-timerange]", scope).forEach(setupTimeRange);
  }

  /* ---------- Selector de rango de hora ---------- */
  function setupTimeRange(wrap) {
    const input = wrap.querySelector(".timerange__input");
    const icon  = wrap.querySelector(".timerange__ic");
    const pop   = wrap.querySelector(".timepop");
    const nums  = {};
    wrap.querySelectorAll(".timepop__num").forEach(n => (nums[n.dataset.k] = n));

    const clamp = (val, max) => {
      let n = parseInt(val.replace(/\D/g, ""), 10);
      if (isNaN(n)) n = 0;
      if (n > max) n = max;
      return String(n).padStart(2, "0");
    };

    const openPop = () => {
      // Cierra otros popovers abiertos
      $$(".timepop", detailBody).forEach(p => { if (p !== pop) p.hidden = true; });
      if (pop.hidden) MZ.sub("rango-hora", "Selector de rango de hora");
      pop.hidden = false;
    };
    // Solo vuelve al slug base si el selector estaba realmente abierto
    const closePop = () => { if (!pop.hidden) { pop.hidden = true; MZ.back(); } };

    input.addEventListener("click", openPop);
    icon.addEventListener("click", openPop);

    // Normaliza al salir de cada campo (horas 0-23, minutos 0-59)
    nums.h1.addEventListener("blur", () => nums.h1.value = clamp(nums.h1.value, 23));
    nums.h2.addEventListener("blur", () => nums.h2.value = clamp(nums.h2.value, 23));
    nums.m1.addEventListener("blur", () => nums.m1.value = clamp(nums.m1.value, 59));
    nums.m2.addEventListener("blur", () => nums.m2.value = clamp(nums.m2.value, 59));

    wrap.querySelector(".timepop__cancel").addEventListener("click", (e) => { e.stopPropagation(); closePop(); });
    wrap.querySelector(".timepop__ok").addEventListener("click", (e) => {
      e.stopPropagation();
      const h1 = clamp(nums.h1.value, 23), m1 = clamp(nums.m1.value, 59);
      const h2 = clamp(nums.h2.value, 23), m2 = clamp(nums.m2.value, 59);
      input.value = `${h1}:${m1} – ${h2}:${m2}`;
      clearError(input);
      closePop();
    });

    // Evita que el popover se cierre al hacer clic dentro
    pop.addEventListener("click", (e) => e.stopPropagation());
    // Cierra al hacer clic fuera
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) closePop(); });
  }

  /* ---------- Carga de archivos ---------- */
  function setupDropzone(zone) {
    const input = zone.querySelector(".dropzone__input");
    const addBtn = zone.querySelector("[data-add]");
    const list = zone.querySelector("[data-filelist]");
    const bar = zone.querySelector("[data-bar]");
    const max = parseInt(zone.dataset.max, 10) || 3;
    const accept = (zone.dataset.accept || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    let files = [];
    zone._files = files;

    function render() {
      list.innerHTML = files.map((f, i) => `
        <li class="chip-file">
          <span class="chip-file__name">${esc(f.name)}</span>
          <button type="button" class="chip-file__remove" data-i="${i}" aria-label="Quitar ${esc(f.name)}">✕</button>
        </li>`).join("");
      list.querySelectorAll(".chip-file__remove").forEach((b) => {
        b.addEventListener("click", (e) => { e.stopPropagation(); files.splice(+b.dataset.i, 1); zone._files = files; render(); });
      });
      // Barra de progreso según nº de archivos / máximo
      if (bar) bar.style.width = `${Math.min(100, (files.length / max) * 100)}%`;
      // El botón + se desactiva al llegar al máximo
      if (addBtn) addBtn.disabled = files.length >= max;
      zone._files = files;
    }

    function accepts(file) {
      if (!accept.length) return true;
      const name = file.name.toLowerCase();
      return accept.some(ext => name.endsWith(ext));
    }

    const needsScan = zone.dataset.scan === "true";

    function add(incoming) {
      let added = null;
      for (const f of incoming) {
        if (files.length >= max) { showToast(`Máximo ${max} archivo(s)`); break; }
        if (!accepts(f)) { showToast(`Formato no permitido: ${f.name}`); continue; }
        files.push(f);
        added = f;
      }
      render();
      clearError(input);
      // Validación IA de la plantilla masiva recién cargada
      if (needsScan && added) scanTemplate(zone, added);
    }

    // Abre el selector solo si no se alcanzó el máximo
    function pick() {
      if (files.length >= max) { showToast(`Solo puedes cargar máximo ${max} archivos`); return; }
      input.click();
    }

    render();
    addBtn.addEventListener("click", (e) => { e.stopPropagation(); pick(); });
    // Clic en la zona (salvo sobre chips) abre el selector
    zone.addEventListener("click", (e) => {
      if (e.target.closest(".chip-file") || e.target.closest("[data-add]")) return;
      pick();
    });
    input.addEventListener("change", () => { add(Array.from(input.files)); input.value = ""; });

    ["dragenter","dragover"].forEach(ev => zone.addEventListener(ev, (e)=>{ e.preventDefault(); zone.classList.add("is-drag"); }));
    ["dragleave","drop"].forEach(ev => zone.addEventListener(ev, (e)=>{ e.preventDefault(); zone.classList.remove("is-drag"); }));
    zone.addEventListener("drop", (e) => { if (e.dataTransfer?.files) add(Array.from(e.dataTransfer.files)); });
  }

  /* ============================================================
     ESCANEO IA · Validación de plantilla masiva (Excel)
     1. Popup "Validando documentos" (spinner ~2s).
     2. Favorable: se cierra el popup y el archivo queda montado (sin mensaje).
     3. Error: popup "Se presentó un error en el archivo" con descarga del
        reporte de errores y opción de volver a cargar.
     Simulación: ~40% de los archivos fallan (aleatorio). Además, si el
     nombre contiene "ok" siempre pasa y si contiene "error" siempre falla,
     para poder forzar cada caso en una demo.
     ============================================================ */
  const ICON_SPINNER = `<svg class="spin" viewBox="0 0 48 48" width="52" height="52"><circle cx="24" cy="24" r="20" fill="none" stroke="#e3f1ef" stroke-width="5"/><path d="M24 4a20 20 0 0 1 20 20" fill="none" stroke="#16a79a" stroke-width="5" stroke-linecap="round"/></svg>`;

  function scanTemplate(zone, file) {
    openModal({
      icon: ICON_SPINNER,
      slug: "validando-plantilla",
      title: "Validando documentos",
      text: "Estamos revisando tu información. Esto puede tardar unos segundos.",
      actions: []            // sin botones mientras valida
    });

    const name = (file && file.name ? file.name : "").toLowerCase();
    let ok;
    if (name.includes("error")) ok = false;
    else if (name.includes("ok")) ok = true;
    else ok = Math.random() > 0.4;   // ~40% de los archivos fallan

    setTimeout(() => {
      if (ok) {
        closeModal();               // favorable: queda montado, sin mensaje
        return;
      }
      // Error: permite descargar el reporte y volver a cargar
      openModal({
        icon: ICON_ERR,
        slug: "error-plantilla",
        title: "Se presentó un error en el archivo",
        text: `Puedes avanzar pero recuerda cargar los documentos pendientes o puedes descargar el siguiente archivo donde te indicamos cuáles son los errores.<br><a href="#" class="modal__link" data-errfile>Archivoconerrores.xls</a>`,
        actions: [
          { label: "Volver", variant: "ghost", onClick: () => {
              // Quita el archivo rechazado para volver a cargar
              zone._files.length = 0;
              const list = zone.querySelector("[data-filelist]"); if (list) list.innerHTML = "";
              const bar = zone.querySelector("[data-bar]"); if (bar) bar.style.width = "0%";
              const addBtn = zone.querySelector("[data-add]"); if (addBtn) addBtn.disabled = false;
              closeModal();
          } },
          { label: "Continuar", onClick: closeModal }   // deja el archivo y sigue
        ]
      });
      const link = modalDialog.querySelector("[data-errfile]");
      if (link) link.addEventListener("click", (e) => {
        e.preventDefault();
        const blob = new Blob(
          ["Reporte de errores de la plantilla\n\nFila 3 · columna 'Llave': valor vacío\nFila 7 · columna 'Fecha': formato inválido (use DD/MM/AAAA)\nFila 12 · columna 'Valor': debe ser numérico"],
          { type: "text/plain" }
        );
        triggerDownload(blob, "Archivoconerrores.xls");
        showToast("Descargando Archivoconerrores.xls");
      });
    }, 2000);
  }

  /* ---------- Validación ---------- */
  function clearError(el) {
    el.classList.remove("is-invalid");
    const field = el.closest(".field");
    const err = field && field.querySelector(".field-error");
    if (err) err.hidden = true;
    const dz = field && field.querySelector(".dropzone");
    if (dz) dz.classList.remove("is-invalid");
  }

  function showError(el) {
    el.classList.add("is-invalid");
    const field = el.closest(".field");
    const err = field && field.querySelector(".field-error");
    if (err) err.hidden = false;
    const dz = field && field.querySelector(".dropzone");
    if (dz) dz.classList.add("is-invalid");
  }

  function validateForm(form) {
    let ok = true;
    let firstBad = null;

    // Inputs / selects / textareas visibles con data-req="true"
    $$("input[data-req], select[data-req], textarea[data-req]", form).forEach((el) => {
      const field = el.closest(".field");
      if (field && field.hidden) return;          // oculto (condicional/variante) → no valida
      if (el.type === "file") return;             // se valida aparte
      let required = el.dataset.req === "true";
      // requerido condicional (p. ej. Estado Devolución)
      if (el.dataset.reqIf === "true") required = !field.hidden;
      if (required && !el.value.trim()) { showError(el); ok = false; firstBad = firstBad || el; }
    });

    // Zonas de archivo requeridas
    $$("[data-dropzone][data-req='true']", form).forEach((zone) => {
      const field = zone.closest(".field");
      if (field && field.hidden) return;
      if (!zone._files || zone._files.length === 0) {
        zone.classList.add("is-invalid");
        const err = field.querySelector(".field-error");
        if (err) err.hidden = false;
        ok = false;
        firstBad = firstBad || zone;
      }
    });

    if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    return ok;
  }

  function showDetail() {
    emptyState.hidden = true;
    detailContent.hidden = false;
    solutionGrid.classList.add("show-detail"); // responsive: muestra panel derecho en móvil
  }

  function resetDetail() {
    activeOptionId = null;
    MZ.state.form = "";
    MZ.state.variant = "";
    markActiveOption(null);
    detailContent.hidden = true;
    detailBody.innerHTML = "";
    emptyState.hidden = false;
    solutionGrid.classList.remove("show-detail");
  }

  /* ============================================================
     VISTA · Crear solicitud vs Consultar estado
     ============================================================ */
  function switchView(view) {
    currentView = view;
    if (view === "consultar") {
      // Modo consulta: panel ancho, oculta formulario y panel verde
      resetDetail();
      consultaHost.hidden = false;
      renderConsultar();
    } else {
      // Modo crear: restaura el layout de dos columnas
      consultaHost.hidden = true;
      consultaHost.innerHTML = "";
      detailPanel.hidden = false;
      solutionGrid.classList.remove("consulta-mode");
      welcomePanel.style.display = "";
      detailSub.hidden = false;
      resetDetail();
      MZ.screen("crear-solicitud", "Crear solicitud");
    }
  }

  /* ============================================================
     CONSULTAR ESTADO
     ============================================================ */
  // Estado del submódulo
  const consultaState = {
    query: "",
    filters: null,         // {modo, desde, hasta, estado, categoria, solicitante, novedad, ans}
    page: 1,
    pageSize: 10
  };
  (function restoreConsulta() {
    const saved = store.get("consulta");
    if (saved && typeof saved === "object") Object.assign(consultaState, saved);
  })();

  const ANS_CLASS = { "A tiempo": "ok", "Por vencer": "warn", "Vencido": "bad" };
  const EST_CLASS = { "En proceso": "progress", "Resuelto": "done" };

  // Íconos de las tarjetas de Tickets y Métricas (coinciden con el diseño)
  const STAT_ICONS = {
    ticketBlue: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3b6fd6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4z"/><path d="M9 7v10"/></svg>`,
    ticketOrange: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e0940f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4z"/><path d="M9 7v10"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16a79a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16a79a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 3v3M16 3v3"/><circle cx="12" cy="14.5" r="3.2"/><path d="M12 13v1.8l1.2.9"/></svg>`
  };

  function nowStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)} - Hora ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Aplica búsqueda + filtros sobre TICKETS
  function getFilteredTickets() {
    let rows = TICKETS.slice();
    const q = consultaState.query.trim().toLowerCase();
    if (q) rows = rows.filter(t => t.ticket.toLowerCase().includes(q));

    const f = consultaState.filters;
    if (f) {
      if (f.estado)      rows = rows.filter(t => t.estado === f.estado);
      if (f.categoria)   rows = rows.filter(t => t.categoria === f.categoria);
      if (f.solicitante) rows = rows.filter(t => t.solicitante === f.solicitante);
      if (f.novedad)     rows = rows.filter(t => t.novedad === f.novedad);
      if (f.ans)         rows = rows.filter(t => t.ans === f.ans);
      // Rango de fechas (compara por la fecha del modo elegido)
      if (f.desde || f.hasta) {
        const campo = f.modo === "Vencimiento" ? "vencimiento" : "creacion";
        rows = rows.filter(t => {
          const d = t[campo].slice(0, 10);
          if (f.desde && d < f.desde) return false;
          if (f.hasta && d > f.hasta) return false;
          return true;
        });
      }
    }
    return rows;
  }

  // Cuenta cuántos filtros están activos (para el badge y los chips)
  function activeFilterList() {
    const f = consultaState.filters;
    if (!f) return [];
    const chips = [];
    if (f.desde || f.hasta) {
      const modo = f.modo || "Creación";
      chips.push({ key: "fecha", label: `${modo}: ${f.desde || "…"} → ${f.hasta || "…"}` });
    }
    if (f.estado)      chips.push({ key: "estado", label: f.estado });
    if (f.categoria)   chips.push({ key: "categoria", label: f.categoria });
    if (f.solicitante) chips.push({ key: "solicitante", label: f.solicitante });
    if (f.novedad)     chips.push({ key: "novedad", label: f.novedad });
    if (f.ans)         chips.push({ key: "ans", label: f.ans });
    return chips;
  }

  function removeFilter(key) {
    if (!consultaState.filters) return;
    const f = consultaState.filters;
    if (key === "fecha") { f.modo = null; f.desde = null; f.hasta = null; }
    else f[key] = null;
    // Si no queda ningún filtro activo, limpia el objeto
    if (activeFilterList().length === 0) consultaState.filters = null;
    consultaState.page = 1;
    renderConsultar();
  }

  function renderConsultar() {
    // El submódulo ocupa todo el ancho (sin panel verde ni panel de detalle)
    emptyState.hidden = true;
    detailSub.hidden = true;
    detailContent.hidden = true;
    detailPanel.hidden = true;
    solutionGrid.classList.add("consulta-mode");
    welcomePanel.style.display = "none";
    showPanelBtn.hidden = true;

    const all = getFilteredTickets();
    const total = all.length;
    const resueltos = all.filter(t => t.estado === "Resuelto").length;
    const abiertos = total - resueltos;
    const chips = activeFilterList();

    // Paginación
    const pages = Math.max(1, Math.ceil(total / consultaState.pageSize));
    if (consultaState.page > pages) consultaState.page = pages;
    const start = (consultaState.page - 1) * consultaState.pageSize;
    const pageRows = all.slice(start, start + consultaState.pageSize);
    const from = total === 0 ? 0 : start + 1;
    const to = Math.min(start + consultaState.pageSize, total);

    const empty = total === 0;

    // Maze: estado de la pantalla → slug (vacío / filtrado / paginado)
    const mzPath = empty
      ? "consultar-estado/sin-solicitudes"
      : (chips.length ? "consultar-estado/filtrado" : "consultar-estado") + (consultaState.page > 1 ? "/pagina-" + consultaState.page : "");
    MZ.screen(mzPath, empty ? "Consultar estado · Sin solicitudes" : "Consultar estado");

    consultaHost.innerHTML = `
      <div class="consulta">
        <div class="consulta__head">
          <div>
            <h1 class="consulta__title">Consultar estado</h1>
            <p class="consulta__subtitle">Sigue el estado de tus solicitudes</p>
            <p class="consulta__stamp">Estás viendo la información registrada ${nowStamp()}</p>
          </div>
          <button class="btn-submit consulta__create" id="consultaCreate">Crear solicitud</button>
        </div>

        <div class="consulta__toolbar">
          <div class="search search--ticket">
            <input type="search" id="ticketSearch" class="search__input" placeholder="Buscar por ticket" value="${esc(consultaState.query)}" />
            <button class="search__btn" id="ticketSearchBtn" aria-label="Buscar">
              <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <button class="filter-btn" id="openFilters">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 5h18M6 12h12M10 19h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Filtros
            ${chips.length ? `<span class="filter-btn__badge">${chips.length}</span>` : ""}
          </button>

          <div class="consulta__chips" id="filterChips">
            ${chips.map(c => `<span class="chip">${esc(c.label)}<button type="button" data-chip="${c.key}" aria-label="Quitar filtro">✕</button></span>`).join("")}
          </div>

          <div class="consulta__tools">
            <div class="dropdown" id="downloadDropdown">
              <button class="icon-btn icon-btn--sm" id="downloadToggle" aria-label="Descargar" aria-haspopup="true" aria-expanded="false">
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div class="dropdown__panel download-panel" role="menu" data-mz-scope="menu-descargar">
                <button class="dropdown__item" data-download="CSV" role="menuitem">Descargar CSV</button>
                <button class="dropdown__item" data-download="XLSX" role="menuitem">Descargar XLSX</button>
              </div>
            </div>
          </div>
        </div>

        <div class="consulta__cards">
          <div class="stat-group">
            <span class="stat-group__title">Tickets</span>
            <div class="stat-row">
              <div class="stat"><span class="stat__label">Totales</span><span class="stat__value">${total.toLocaleString("es-CO")}</span><span class="stat__ic stat__ic--a">${STAT_ICONS.ticketBlue}</span></div>
              <div class="stat"><span class="stat__label">Abiertos</span><span class="stat__value">${abiertos.toLocaleString("es-CO")}</span><span class="stat__ic stat__ic--b">${STAT_ICONS.ticketOrange}</span></div>
              <div class="stat"><span class="stat__label">Resueltos</span><span class="stat__value">${resueltos.toLocaleString("es-CO")}</span><span class="stat__ic stat__ic--c">${STAT_ICONS.check}</span></div>
            </div>
          </div>
          <div class="stat-group">
            <span class="stat-group__title">Metricas</span>
            <div class="stat-row">
              <div class="stat"><span class="stat__label">ANS General</span><span class="stat__value">${empty ? "0%" : "97,25%"}</span><span class="stat__ic stat__ic--d">${STAT_ICONS.calendar}</span></div>
            </div>
          </div>
        </div>

        ${empty ? `
          <div class="consulta-empty">
            <div class="hourglass" aria-hidden="true">
              <span class="hourglass__dot hourglass__dot--1"></span>
              <span class="hourglass__dot hourglass__dot--2"></span>
              <svg viewBox="0 0 120 120" width="150" height="150">
                <ellipse cx="60" cy="60" rx="46" ry="46" fill="#dff1ee"/>
                <path d="M42 34h36M42 86h36" stroke="#2b2b2b" stroke-width="4" stroke-linecap="round"/>
                <path d="M46 34c0 14 28 18 28 26s-28 12-28 26M74 34c0 14-28 18-28 26s28 12 28 26" fill="none" stroke="#2b2b2b" stroke-width="2.4"/>
                <path d="M52 44c0 6 16 8 16 8s-16 2-16 8" fill="#f4a9b8"/>
              </svg>
            </div>
            <p class="consulta-empty__text">En el día de hoy no tienes<br>solicitudes creadas</p>
          </div>
        ` : `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ticket</th><th>Fecha de creación</th><th>Fecha de vencimiento</th>
                  <th>Estado</th><th>Solicitante</th><th>ANS</th><th>Novedad</th>
                </tr>
              </thead>
              <tbody>
                ${pageRows.map(t => `
                  <tr class="data-row" data-ticket="${esc(t.ticket)}" tabindex="0">
                    <td>${esc(t.ticket)}</td>
                    <td>${esc(t.creacion)}</td>
                    <td>${esc(t.vencimiento)}</td>
                    <td><span class="pill pill--${EST_CLASS[t.estado]}">${esc(t.estado)}</span></td>
                    <td>${esc(t.solicitante)}</td>
                    <td><span class="ans ans--${ANS_CLASS[t.ans]}"><span class="ans__dot"></span>${esc(t.ans)}</span></td>
                    <td>${esc(t.novedad)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>

          <div class="pager">
            <span>Filas por página</span>
            <select id="pageSize">
              ${[10,20,50].map(n=>`<option value="${n}" ${n===consultaState.pageSize?"selected":""}>${n}</option>`).join("")}
            </select>
            <span class="pager__range">${from}-${to} de ${total} items</span>
            <button class="pager__nav" id="prevPage" ${consultaState.page<=1?"disabled":""} aria-label="Anterior">‹</button>
            <button class="pager__nav" id="nextPage" ${consultaState.page>=pages?"disabled":""} aria-label="Siguiente">›</button>
          </div>
        `}
      </div>`;

    wireConsulta();
  }

  function wireConsulta() {
    // Crear solicitud → vuelve a modo formulario
    $("#consultaCreate", consultaHost).addEventListener("click", () => {
      const sub = $('.nav-subitem[data-view="crear"]');
      if (sub) sub.click();
    });

    // Búsqueda por ticket
    const ts = $("#ticketSearch", consultaHost);
    const doSearch = () => { consultaState.query = ts.value; consultaState.page = 1; renderConsultar(); };
    $("#ticketSearchBtn", consultaHost).addEventListener("click", doSearch);
    ts.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    // Abrir popup de filtros
    $("#openFilters", consultaHost).addEventListener("click", openFiltersModal);

    // Quitar chip
    $$("[data-chip]", consultaHost).forEach(b => b.addEventListener("click", () => removeFilter(b.dataset.chip)));

    // Menú de descarga
    const dd = $("#downloadDropdown", consultaHost);
    const ddBtn = $("#downloadToggle", consultaHost);
    ddBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains("open");
      closeAllDropdowns();
      dd.classList.toggle("open", open);
      ddBtn.setAttribute("aria-expanded", String(open));
      if (open) MZ.sub("menu-descargar", "Menú descargar");
    });
    dd.querySelector(".dropdown__panel").addEventListener("click", (e) => e.stopPropagation());
    $$("[data-download]", consultaHost).forEach(b =>
      b.addEventListener("click", () => { closeAllDropdowns(); downloadTickets(b.dataset.download); })
    );

    // Abrir el detalle del ticket al hacer clic (o Enter) en una fila
    $$(".data-row", consultaHost).forEach((row) => {
      const open = () => openTicketDrawer(row.dataset.ticket);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    });

    // Paginación
    const ps = $("#pageSize", consultaHost);
    if (ps) ps.addEventListener("change", () => { consultaState.pageSize = +ps.value; consultaState.page = 1; renderConsultar(); });
    const prev = $("#prevPage", consultaHost);
    const next = $("#nextPage", consultaHost);
    if (prev) prev.addEventListener("click", () => { if (consultaState.page>1){ consultaState.page--; renderConsultar(); } });
    if (next) next.addEventListener("click", () => { consultaState.page++; renderConsultar(); });
  }

  /* ---------- Popup de Filtros ---------- */
  function selectField(label, id, opts, value, placeholder) {
    return `<div class="field">
      <label for="flt-${id}">${label}</label>
      <select id="flt-${id}">
        <option value="">${placeholder || "Selecciona una opción"}</option>
        ${opts.map(o=>`<option value="${esc(o)}" ${o===value?"selected":""}>${esc(o)}</option>`).join("")}
      </select>
    </div>`;
  }

  function openFiltersModal() {
    const f = consultaState.filters || {};
    // Reutilizamos el contenedor del modal con un layout propio
    modal.classList.add("modal--filters");
    modal.hidden = false;
    // Maze: el popup de filtros es una pantalla propia
    modal.dataset.mzScope = "popup-filtros";
    modalDialog.id = "mz-popup-filtros";
    modalDialog.setAttribute("data-maze", "popup__filtros");
    modalDialog.setAttribute("data-maze-type", "popup");
    MZ.sub("filtros", "Filtros");
    const dialog = modalDialog;
    dialog.innerHTML = `
      <div class="filters">
        <div class="filters__head">
          <h2 class="filters__title">Filtros</h2>
          <button class="filters__close" id="fltClose" aria-label="Cerrar">✕</button>
        </div>

        <p class="filters__legend">Selecciona el modo de mostrar la fecha</p>
        <div class="radio-row">
          <label class="radio"><input type="radio" name="modo" value="Creación" ${(!f.modo||f.modo==="Creación")?"checked":""}> Creación</label>
          <label class="radio"><input type="radio" name="modo" value="Vencimiento" ${f.modo==="Vencimiento"?"checked":""}> Vencimiento</label>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="fltDesde">Desde <span class="req">*</span></label>
            <div class="input-icon"><input type="date" id="fltDesde" value="${f.desde||""}"><span class="input-icon__btn">${SVG_CAL}</span></div>
          </div>
          <div class="field">
            <label for="fltHasta">Hasta <span class="req">*</span></label>
            <div class="input-icon"><input type="date" id="fltHasta" value="${f.hasta||""}"><span class="input-icon__btn">${SVG_CAL}</span></div>
          </div>
        </div>
        <small class="field-error" id="fltDateErr" hidden>Selecciona el rango de fechas (obligatorio).</small>

        ${selectField("Estado del ticket", "estado", FILTER_OPTIONS.estado, f.estado)}
        ${selectField("Categoría", "categoria", FILTER_OPTIONS.categoria, f.categoria)}
        ${selectField("Solicitante", "solicitante", FILTER_OPTIONS.solicitante, f.solicitante)}
        ${selectField("Novedad", "novedad", FILTER_OPTIONS.novedad, f.novedad)}
        ${selectField("ANS por ticket", "ans", FILTER_OPTIONS.ans, f.ans)}

        <div class="filters__actions">
          <button type="button" class="btn-ghost" id="fltReset">Restaurar todo</button>
          <button type="button" class="btn-submit" id="fltApply">Aplicar</button>
        </div>
      </div>`;

    // Cerrar el popup de filtros y dejar el diálogo listo para los modales estándar
    const close = () => {
      MZ.back();
      modal.hidden = true;
      modal.classList.remove("modal--filters");
      dialog.className = "modal__dialog";
      dialog.innerHTML = MODAL_BASE;
    };
    $("#fltClose", dialog).addEventListener("click", close);

    $("#fltReset", dialog).addEventListener("click", () => {
      consultaState.filters = null;
      consultaState.page = 1;
      close();
      renderConsultar();
    });

    $("#fltApply", dialog).addEventListener("click", () => {
      const desde = $("#fltDesde", dialog).value;
      const hasta = $("#fltHasta", dialog).value;
      const err = $("#fltDateErr", dialog);
      // La fecha es el único campo obligatorio
      if (!desde || !hasta) { err.hidden = false; return; }
      if (desde > hasta) { err.textContent = "La fecha inicial no puede ser mayor que la final."; err.hidden = false; return; }
      const modo = (dialog.querySelector('input[name="modo"]:checked') || {}).value || "Creación";
      consultaState.filters = {
        modo, desde, hasta,
        estado:      $("#flt-estado", dialog).value || null,
        categoria:   $("#flt-categoria", dialog).value || null,
        solicitante: $("#flt-solicitante", dialog).value || null,
        novedad:     $("#flt-novedad", dialog).value || null,
        ans:         $("#flt-ans", dialog).value || null
      };
      consultaState.page = 1;
      close();
      renderConsultar();
    });
  }

  /* ---------- Descarga (demo) ---------- */
  function downloadTickets(fmt) {
    const rows = getFilteredTickets();
    if (fmt === "CSV") {
      const header = ["Ticket","Fecha de creación","Fecha de vencimiento","Estado","Solicitante","ANS","Novedad"];
      const csv = [header.join(",")].concat(
        rows.map(t => [t.ticket,t.creacion,t.vencimiento,t.estado,t.solicitante,t.ans,t.novedad].map(v=>`"${v}"`).join(","))
      ).join("\n");
      const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, "consultar_estado.csv");
      showToast("Descargando CSV");
    } else {
      // XLSX real requeriría una librería; para la demo entregamos CSV con extensión reconocible
      showToast("Descargando XLSX (demo)");
    }
  }
  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Descarga de un archivo adjunto (demo: genera un archivo con el mismo nombre)
  function downloadAttachment(name) {
    const blob = new Blob([`Archivo de demostración: ${name}\nGenerado desde el Centro de Solución Bre-B.`], { type: "text/plain" });
    triggerDownload(blob, name);
    showToast(`Descargando ${name}`);
  }

  /* ============================================================
     DRAWER · Detalle del ticket (panel lateral derecho)
     ============================================================ */
  const drawer       = $("#ticketDrawer");
  const drawerPanel  = $("#drawerPanel");
  const drawerOverlay= $("#drawerOverlay");

  // Devuelve solo la fecha DD/MM/AAAA de un stamp "AAAA-MM-DD HH:MM:SS" o "AAAA-MM-DD"
  function fmtDate(stamp) {
    const d = (stamp || "").slice(0, 10).split("-");
    if (d.length < 3) return stamp || "";
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  // Días transcurridos desde la creación hasta hoy (o hasta el cierre si está resuelto)
  function daysElapsed(t) {
    const start = new Date((t.creacion || "").slice(0, 10));
    let end = new Date();
    if (t.solucion && t.solucion.cierre) {
      // cierre viene como DD/MM/AAAA
      const c = t.solucion.cierre.split("/");
      if (c.length === 3) end = new Date(`${c[2]}-${c[1]}-${c[0]}`);
    }
    if (isNaN(start)) return 0;
    const diff = Math.floor((end - start) / 86400000);
    return Math.max(0, diff);
  }

  const DOC_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`;
  const DL_ICON  = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 21h14"/></svg>`;

  function attachmentsHTML(list) {
    if (!list || !list.length) return `<p class="drawer__muted">En este caso no se cargaron archivos adjuntos disponibles.</p>`;
    return `<div class="attach-list">${list.map(a => `
      <button type="button" class="attach" data-file="${esc(a.name)}">
        <span class="attach__ic">${DOC_ICON}</span>
        <span class="attach__name">${esc(a.name)}</span>
        <span class="attach__dl">${DL_ICON}</span>
      </button>`).join("")}</div>`;
  }

  function openTicketDrawer(ticketId) {
    const t = TICKETS.find(x => x.ticket === ticketId);
    if (!t) return;

    const ansClass = ANS_CLASS[t.ans];
    const dias = daysElapsed(t);
    const resuelto = !!t.solucion;

    const comentariosHTML = (t.comentarios && t.comentarios.length)
      ? `<div class="timeline">
          ${t.comentarios.map(c => `
            <div class="timeline__item">
              <span class="timeline__dot"></span>
              <div class="timeline__body">
                <p class="timeline__head">Solicitud <span>${esc(c.area)}</span></p>
                <p class="timeline__meta">${esc(c.fecha)}<br>Usuario: ${esc(c.usuario)}</p>
                <p class="timeline__text">Comentario: ${esc(c.texto)}</p>
              </div>
            </div>`).join("")}
         </div>`
      : "";

    const solucionHTML = resuelto
      ? `<div class="timeline__item timeline__item--sol">
           <span class="timeline__dot timeline__dot--sol"></span>
           <div class="timeline__body">
             <h3 class="drawer__section">Solución</h3>
             <p class="drawer__sol-from">${esc(t.solucion.de)}</p>
             <p class="drawer__sol-text">${esc(t.solucion.texto).replace(/\n/g, "<br>")}</p>
             ${t.solucion.adjuntos && t.solucion.adjuntos.length ? attachmentsHTML(t.solucion.adjuntos) : ""}
             <p class="drawer__cierre"><strong>${esc(t.solucion.cierre)}</strong><br><span>Fecha de cierre</span></p>
           </div>
         </div>`
      : "";

    drawerPanel.innerHTML = `
      <div class="drawer__topbar">
        <button class="drawer__back" id="drawerBack" aria-label="Volver">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
      </div>

      <div class="drawer__card">
        <div class="drawer__card-top">
          <span class="drawer__ticket">Ticket ${esc(t.ticket)}</span>
          <span class="ans ans--${ansClass}"><span class="ans__dot"></span>ANS ${esc(t.ans)}</span>
        </div>
        <h2 class="drawer__ticket-title">${esc(t.titulo)}</h2>
        <p class="drawer__ticket-sub">${esc(t.subtitulo)}</p>
        <p class="drawer__escalado"><strong>Escalado a:</strong> ${esc(t.escalado)}</p>
        ${t.novedad ? `<p class="drawer__escalado"><strong>Novedad:</strong> ${esc(t.novedad)}</p>` : ""}
      </div>

      <div class="drawer__dates">
        <div><span class="drawer__date drawer__date--c">${fmtDate(t.creacion)}</span><span class="drawer__date-lbl">Fecha de Creación</span></div>
        <div><span class="drawer__date drawer__date--v">${fmtDate(t.vencimiento)}</span><span class="drawer__date-lbl">Fecha de Vencimiento</span></div>
        <div><span class="drawer__days">${dias}</span><span class="drawer__date-lbl">Cantidad de días</span></div>
      </div>

      <div class="drawer__scroll">
        <h3 class="drawer__section">Adjuntos del solicitante</h3>
        ${attachmentsHTML(t.adjuntos)}

        ${comentariosHTML || solucionHTML ? `<div class="drawer__divider"></div>` : ""}
        ${comentariosHTML}
        ${solucionHTML}
      </div>`;

    // Listeners
    $("#drawerBack", drawerPanel).addEventListener("click", closeDrawer);
    $$("[data-file]", drawerPanel).forEach(b => b.addEventListener("click", () => downloadAttachment(b.dataset.file)));

    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    // Maze: detalle de ticket con su estado (sin/con solución + ANS)
    MZ.overlay(
      "consultar-estado/ticket/" + MZ.slug(t.ticket) + "/" + (resuelto ? "con-solucion" : "sin-solucion") + "/ans-" + MZ.slug(t.ans),
      "Detalle ticket " + t.ticket
    );
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    setTimeout(() => { drawer.hidden = true; }, 260);
    MZ.back();
  }
  drawerOverlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });

  /* ============================================================
     BÚSQUEDA · Filtra categorías/opciones y resalta coincidencias
     ============================================================ */
  const searchInput = $("#searchInput");
  const searchBtn   = $("#searchBtn");
  const noResults   = $("#noResults");

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    let anyVisible = false;

    $$(".acc-item", accordion).forEach((item) => {
      const cat = CATEGORIES.find((c) => c.id === item.dataset.catId);
      const options = $$(".acc-option", item);
      let matchInCat = false;

      if (!q) {
        // Sin búsqueda: restaura todo y cierra
        item.classList.remove("is-hidden", "is-open");
        item.querySelector(".acc-head").setAttribute("aria-expanded", "false");
        options.forEach((btn, i) => {
          btn.classList.remove("is-hidden");
          btn.querySelector(".acc-option__label").innerHTML = cat.options[i].label;
        });
        return;
      }

      options.forEach((btn, i) => {
        const opt = cat.options[i];
        const hay = (opt.label + " " + opt.desc).toLowerCase();
        const match = hay.includes(q);
        btn.classList.toggle("is-hidden", !match);
        if (match) {
          matchInCat = true;
          // Resaltado
          const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
          btn.querySelector(".acc-option__label").innerHTML =
            opt.label.replace(re, "<mark>$1</mark>");
        }
      });

      const catLabelMatch = cat.label.toLowerCase().includes(q);
      if (catLabelMatch && !matchInCat) {
        options.forEach((btn) => btn.classList.remove("is-hidden"));
        matchInCat = true;
      }

      item.classList.toggle("is-hidden", !matchInCat);
      item.classList.toggle("is-open", matchInCat); // abre las categorías con coincidencias
      item.querySelector(".acc-head").setAttribute("aria-expanded", String(matchInCat));
      if (matchInCat) anyVisible = true;
    });

    noResults.hidden = !q || anyVisible;

    // Maze: estados del buscador (vacío / con resultados / sin resultados)
    // Se filtra en cada tecla: la URL cambia sin recargar (recargar borraría lo escrito)
    if (!activeOptionId) {
      const soft = { replace: true };
      if (!q) MZ.screen("crear-solicitud", "Crear solicitud", soft);
      else if (anyVisible) MZ.screen("crear-solicitud/busqueda/con-resultados", "Búsqueda con resultados", soft);
      else MZ.screen("crear-solicitud/busqueda/sin-resultados", "Búsqueda sin resultados", soft);
    }
  }

  searchInput.addEventListener("input", runSearch);
  searchBtn.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

  /* ============================================================
     OCULTAR / MOSTRAR panel de bienvenida
     ============================================================ */
  const hidePanelBtn = $("#hidePanelBtn");
  const showPanelBtn = $("#showPanelBtn");
  const welcomePanel = $("#welcomePanel");

  // Muestra u oculta el panel de selección (lo usan los botones y el historial del navegador)
  function setPanelHidden(hide) {
    welcomePanel.style.display = hide ? "none" : "";
    showPanelBtn.hidden = !hide;
    solutionGrid.classList.toggle("panel-hidden", hide);
  }
  hidePanelBtn.addEventListener("click", () => {
    setPanelHidden(true);
    MZ.sub("panel-oculto", "Panel de selección oculto");
  });
  showPanelBtn.addEventListener("click", () => {
    setPanelHidden(false);
    MZ.back();
  });

  /* ============================================================
     NAVEGACIÓN POR HISTORIAL (botón Atrás / Adelante / enlaces ?pantalla=slug)
     Restaura la pantalla, el formulario y su variante a partir del slug.
     Se ejecuta en modo "silencioso": la UI cambia sin reescribir la URL
     y, al final, la URL se reconcilia con lo que realmente se muestra.
     Límite: los datos ya escritos en un formulario no se conservan al
     volver con Atrás (el formulario se vuelve a dibujar vacío).
     ============================================================ */
  function setNavActive(view) {
    $$(".nav-subitem[data-view]").forEach((s) => s.classList.toggle("nav-subitem--active", s.dataset.view === view));
  }

  // Abre solo la categoría indicada (o ninguna) en el acordeón
  function openCategoryBySlug(catSlug) {
    let openId = null;
    $$(".acc-item", accordion).forEach((i) => {
      const on = !!catSlug && MZ.slug(i.dataset.catId) === catSlug;
      i.classList.toggle("is-open", on);
      i.querySelector(".acc-head").setAttribute("aria-expanded", String(on));
      if (on) openId = i.dataset.catId;
    });
    activeCategoryId = openId;
  }

  function closeAllOverlays() {
    if (!modal.hidden) closeModal(true);
    if (!drawer.hidden) closeDrawer();
    closeAllDropdowns();
    $$(".timepop", detailBody).forEach((p) => { p.hidden = true; });
    if (sidebar.classList.contains("is-open")) closeMobileSidebar();
  }

  function applyRoute(path) {
    const seg = String(path || "").split("/").filter(Boolean);
    MZ.beginRoute();
    try {
      closeAllOverlays();

      /* ---------- Consultar estado ---------- */
      if (seg[0] === "consultar-estado") {
        const keep = seg.indexOf("filtrado") !== -1 || ["ticket", "filtros", "menu-descargar"].indexOf(seg[1]) !== -1;
        const pg = seg.find((x) => /^pagina-\d+$/.test(x));
        if (!keep) { consultaState.filters = null; consultaState.query = ""; }
        if (pg) consultaState.page = parseInt(pg.slice(7), 10);
        else if (["ticket", "filtros", "menu-descargar"].indexOf(seg[1]) === -1) consultaState.page = 1;

        if (currentView !== "consultar") { setNavActive("consultar"); switchView("consultar"); }
        else renderConsultar();

        if (seg[1] === "ticket" && seg[2]) {
          const t = TICKETS.find((x) => MZ.slug(x.ticket) === seg[2]);
          if (t) openTicketDrawer(t.ticket);
        } else if (seg[1] === "filtros") {
          openFiltersModal();
        }
        return;
      }

      /* ---------- Crear solicitud (categorías y formularios) ---------- */
      if (currentView === "consultar") { setNavActive("crear"); switchView("crear"); }
      if (searchInput.value) { searchInput.value = ""; runSearch(); }

      const cat = CATEGORIES.find((c) => MZ.slug(c.id) === seg[1]);
      const opt = cat && cat.options.find((o) => MZ.slug(o.id) === seg[2]);

      if (opt) {
        // Formulario de una subcategoría (+ variante Unitaria/Masiva)
        openCategoryBySlug(seg[1]);
        if (activeOptionId !== opt.id) selectOption(cat.id, opt.id);
        const sel = $("#f-novedad", detailBody);
        if (sel) {
          const want = ["unitaria", "masiva"].indexOf(seg[3]) !== -1 ? seg[3] : "";
          if (MZ.slug(sel.value) !== want) {
            const match = Array.from(sel.options).find((o) => MZ.slug(o.value) === want);
            sel.value = match ? match.value : "";
            sel.dispatchEvent(new Event("change"));
          }
        }
      } else {
        // Pantalla de categorías (con una categoría abierta o ninguna)
        if (activeOptionId) { resetDetail(); }
        openCategoryBySlug(seg[1] === "categoria" ? seg[2] : "");
        MZ.screen(seg[1] === "categoria" && seg[2] ? "crear-solicitud/categoria/" + seg[2] : "crear-solicitud", "Crear solicitud");
      }
      setPanelHidden(seg.indexOf("panel-oculto") !== -1);
    } finally {
      MZ.endRoute();
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  renderAccordion();
  // Abre "Operaciones" por defecto como en la referencia
  const firstItem = $(".acc-item", accordion);
  if (firstItem) {
    firstItem.classList.add("is-open");
    firstItem.querySelector(".acc-head").setAttribute("aria-expanded", "true");
    activeCategoryId = firstItem.dataset.catId;
  }

  // Maze: etiquetado automático + historial del navegador
  MZ.init();
  MZ.onNavigate(applyRoute);
  const initialRoute = MZ.readRoute();
  if (initialRoute) {
    // Enlace directo a una pantalla (?pantalla=consultar-estado, ?pantalla=crear-solicitud/...)
    applyRoute(initialRoute);
  } else {
    MZ.screen("crear-solicitud/categoria/" + MZ.slug(activeCategoryId || ""), "Crear solicitud", { replace: true });
  }
  restoreDraft();
  MZ.ready();

  /* ---------- Borrador del formulario ----------
     Al pasar de pantalla (p. ej. elegir Unitaria/Masiva) la página se recarga;
     lo ya escrito se guarda y se vuelve a poner si se regresa al mismo formulario.
     Los archivos adjuntos no se pueden conservar entre cargas (limitación del navegador). */
  function collectDraft() {
    if (!activeOptionId) return null;
    const values = {};
    $$("input, select, textarea", detailBody).forEach((el) => {
      if (!el.id || el.type === "file") return;
      values[el.id] = (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
    });
    return { opt: activeOptionId, values };
  }
  function restoreDraft() {
    const d = store.get("draft");
    if (!d || d.opt !== activeOptionId || !d.values) return;
    Object.keys(d.values).forEach((id) => {
      if (id === "f-novedad") return;              // la variante la decide la URL
      const el = document.getElementById(id);
      if (!el || !detailBody.contains(el)) return;
      if (el.type === "checkbox" || el.type === "radio") el.checked = !!d.values[id];
      else el.value = d.values[id];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  // Se guarda en el instante en que la app pide la pantalla nueva (antes de que el
  // código siguiente redibuje el formulario) y, como respaldo, al salir de la página
  // (Atrás del navegador, cerrar pestaña).
  let savedForNav = false;
  function saveState() {
    store.set("tickets", TICKETS);
    store.set("consulta", { query: consultaState.query, filters: consultaState.filters, page: consultaState.page, pageSize: consultaState.pageSize });
    const d = collectDraft();
    if (d) store.set("draft", d); else store.clear("draft");
  }
  window.addEventListener("maze:url", (e) => {
    if (e.detail.replace || MZ.navMode !== "recarga") return;
    saveState();
    savedForNav = true;
  });
  window.addEventListener("pagehide", () => {
    if (savedForNav) { store.set("tickets", TICKETS); return; }
    saveState();
  });

  /* ============================================================
     MAZE · Panel de diagnóstico (solo con ?mazedebug=1 en la URL)
     Muestra si el snippet de Maze cargó, la URL actual y cada
     cambio de URL que Maze debería registrar como paso nuevo.
     No se etiqueta (data-mz-ignore) ni aparece a los participantes.
     ============================================================ */
  (function mazeDebug() {
    if (new URLSearchParams(location.search).get("mazedebug") !== "1") return;
    const box = document.createElement("div");
    box.setAttribute("data-mz-ignore", "");
    box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;width:min(420px,calc(100vw - 24px));max-height:45vh;overflow:auto;" +
      "background:#111;color:#eee;font:12px/1.4 ui-monospace,Consolas,monospace;border-radius:10px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.35)";
    document.body.appendChild(box);
    let steps = [];
    try { steps = JSON.parse(sessionStorage.getItem("breb:mazeSteps")) || []; } catch (e) {}
    const saveSteps = () => { try { sessionStorage.setItem("breb:mazeSteps", JSON.stringify(steps.slice(-40))); } catch (e) {} };
    function snippetStatus() {
      const res = performance.getEntriesByType("resource").filter((e) => /maze\.co/.test(e.name));
      const loader = res.some((e) => /maze-universal-loader/.test(e.name));
      if (!loader && performance.now() < 10000) return { ok: null, txt: "Esperando el loader de Maze…" };
      if (!loader) return { ok: false, txt: "NO cargó el loader de Maze (¿bloqueador de anuncios? ¿sin internet?)" };
      return { ok: true, txt: "Loader cargado · " + res.length + " recurso(s) de maze.co" };
    }
    function esc(t) { return String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
    function render() {
      const st = snippetStatus();
      box.innerHTML =
        "<b>Maze debug</b><br>" +
        "<span style='color:" + (st.ok ? "#5fd38d" : st.ok === null ? "#f5c26b" : "#ff6b6b") + "'>● " + esc(st.txt) + "</span><br>" +
        "URL: <span style='color:#9cd2ff'>" + esc(location.pathname + location.search) + "</span><br>" +
        "Modo: <b>" + MZ.navMode + "</b> · Cargas de página registradas: " + steps.filter((x) => x.load).length +
        " <button id='mzDbgClear' style='margin-left:6px;font:inherit;background:#333;color:#eee;border:0;border-radius:4px;padding:1px 6px;cursor:pointer'>limpiar</button>" +
        "<ol style='margin:6px 0 0 18px;padding:0'>" +
        steps.slice(-12).map((x) => "<li>" + (x.load ? "<b style='color:#5fd38d'>[página]</b> " : "<i style='color:#aaa'>[overlay]</i> ") + esc(x.path) + "</li>").join("") + "</ol>";
      const clr = box.querySelector("#mzDbgClear");
      if (clr) clr.onclick = () => { steps = []; saveSteps(); render(); };
    }
    steps.push({ path: MZ.readRoute() || "(inicio)", load: true });
    saveSteps();
    window.addEventListener("maze:url", (e) => {
      if (e.detail.replace) { steps.push({ path: e.detail.path, load: false }); saveSteps(); render(); }
    });
    render();
    // El snippet carga async: revisa cada segundo hasta confirmarlo (máx. 11 s)
    const poll = setInterval(() => { render(); if (snippetStatus().ok !== null) clearInterval(poll); }, 1000);
    setTimeout(() => clearInterval(poll), 11000);
  })();
})();
