/* ============================================================
   Centro de Solución Bre-B · Catálogo de PQRS
   Fuente: Desarrollo_PQRS.xlsx (hoja Categoría/Subcategoría/Descripción/Formulario)
   Cada subcategoría guarda su "form" (número de formulario) para
   construir el formulario de "Crea tu solicitud" correspondiente.
   ============================================================ */

const ICONS = {
  operaciones: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 20V10M10 20V5M16 20v-7M22 20H3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  llaves: `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12h9m-3 0v3m-2-3v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  errores: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M14 7l3 3M3 21l4-1 11-11-3-3L4 17l-1 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 3l6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  fraude: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 12l1.8 1.8L15 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  facturacion: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 3h9l3 3v15l-2-1-2 1-2-1-2 1-2-1-2 1V3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  implementaciones: `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 21h8M12 18v3M8 9l-2 2 2 2M16 9l2 2-2 2M13 8l-2 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  legal: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7zM17 7l-3 6a3 3 0 0 0 6 0l-3-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  monitoreo: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 12h4l2 5 4-12 2 7h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

/* Orden de categorías tal como se presenta en el diseño */
const CATEGORIES = [
  {
    id: "operaciones",
    label: "Operaciones",
    icon: ICONS.operaciones,
    options: [
      { id: "op-crear-usuarios",   label: "Crear modificar eliminar usuario perfiles", desc: "Crear, modificar o eliminar usuarios y perfiles en la herramienta de monitoreo de fraude.", form: "Form 4" },
      { id: "op-duplicidad",       label: "Duplicidad de operaciones", desc: "Se realizó doble cobro por una o varias transacciones.", form: "Form 9" },
      { id: "op-listado",          label: "Listado transaccional", desc: "Información sobre datáfonos, interoperabilidad y transacciones.", form: "Form 5" },
      { id: "op-cuadre",           label: "Apoyo cuadre compensación", desc: "Ayuda para cuadrar compensación, liquidación, conciliación o errores en el archivo.", form: "Form 8" },
      { id: "op-acceso-portal",    label: "Acceso Portal", desc: "Crear, eliminar o desbloquear usuarios del portal GAW, dashboard.", form: "Form 4" },
      { id: "op-asesoria",         label: "Asesoria manejo de herramienta", desc: "Consulta sobre uso de opciones del portal.", form: "Form 5" },
      { id: "op-trx-conciliacion", label: "Trx sin actualización tras conciliación", desc: "La transacción sigue pendiente sin confirmación final.", form: "Form 9" },
      { id: "op-errores-archivo",  label: "Errores estructura archivo conciliación", desc: "Archivo diario tiene errores o no se entregó correctamente.", form: "Form 8" },
      { id: "op-aclaracion",       label: "Aclaración de resultado de transacción (operaciones)", desc: "Se solicita explicación del resultado final de una transacción.", form: "Form 9" },
      { id: "op-devoluciones",     label: "Devoluciones SPBVI", desc: "Reclamo por pago enviado a una llave equivocada.", form: "Form 9" },
      { id: "op-estado-dev",       label: "Estado de devolución", desc: "Consulta sobre estado de procesos de devolución o reverso.", form: "Form 9" },
      { id: "op-dev-fraude",       label: "Devolución dineros por fraude", desc: "Reclamo por fraude en eventos distintos a compras por COE.", form: "Form 9" }
    ]
  },
  {
    id: "llaves",
    label: "Llaves",
    icon: ICONS.llaves,
    options: [
      { id: "ll-historico",      label: "Histórico de llaves por entidad", desc: "Solicitud de llaves asociadas a entidad.", form: "Form 3" },
      { id: "ll-ya-registrada",  label: "Llave ya registrada", desc: "La llave que se intenta registrar ya está asociada a otro participante.", form: "Form 3" },
      { id: "ll-error-registro", label: "Error en el registro de llave", desc: "Llave registrada incorrectamente.", form: "Form 3" },
      { id: "ll-novedad",        label: "Novedad de llaves", desc: "Llave ya registrada sin autorización.", form: "Form 3" },
      { id: "ll-desvincular",    label: "Imposibilidad para desvincular llave", desc: "No se puede eliminar llave activa.", form: "Form 3" },
      { id: "ll-portabilidad",   label: "Falla en portabilidad de llave", desc: "Error al trasladar llave a otra entidad.", form: "Form 3" }
    ]
  },
  {
    id: "errores",
    label: "Errores técnicos",
    icon: ICONS.errores,
    options: [
      { id: "err-oauth",         label: "Fallo en autenticación Oauth", desc: "No puedes acceder por error vía OAuth, en credenciales o URL.", form: "Form 1" },
      { id: "err-api",           label: "Fallas con los servicios api", desc: "El sistema tarda mucho en responder o cargar información.", form: "Form 1" },
      { id: "err-dice",          label: "Errores en envío o recepción de msn DICE", desc: "Falla al enviar o recibir mensajes por el canal DICE.", form: "Form 1" },
      { id: "err-mol",           label: "Fallos procesamiento o validación en MOL", desc: "Problemas al procesar información en el sistema MOL.", form: "Form 1" },
      { id: "err-formato-api",   label: "Rechazo por errores en formato de API", desc: "Solicitud rechazada por errores en el formato del mensaje enviado de API.", form: "Form 1" },
      { id: "err-encriptacion",  label: "Falla encriptación o seguridad de datos", desc: "Problemas con el cifrado o protección de la información transmitida.", form: "Form 1" },
      { id: "err-mantenimiento", label: "Error caída por mantenimiento de sistema", desc: "El sistema no está disponible por mantenimiento o actualización.", form: "Form 1" },
      { id: "err-cco",           label: "Falla Tecnica CCO", desc: "No se puede enviar información al sistema MOL desde Credibanco.", form: "Form 1" },
      { id: "err-banrep",        label: "Falla Tecnica BanRep", desc: "No hay confirmación de recepción desde BanRep. Se debe comunicar el incidente.", form: "Form 1" },
      { id: "err-dispersion",    label: "Novedad Dispersión Masiva SPI", desc: "El participante solicita la validación del lote de transacciones enviado mediante API para la generación de una dispersión masiva. Se confirma análisis de lote, procesamiento y ejecutado exitosamente dentro del ecosistema Bre-B.", form: "Form 1" },
      { id: "err-notificaciones",label: "Falla sistema de notificaciones técnicas", desc: "Demora o falta de notificaciones técnicas trx.", form: "Form 1" }
    ]
  },
  {
    id: "fraude",
    label: "Monitoreo del fraude",
    icon: ICONS.fraude,
    options: [
      { id: "fr-asesoria",   label: "Asesoría Fraude Transaccional", desc: "Asesoria sobre monitoreo y deteccion del fraude transaccional.", form: "Form 7" },
      { id: "fr-reporte",    label: "Reporte Gestion de monitoreo de usuarios", desc: "Solicitud de reporte sobre reglas, transacciones y bitácoras de riesgo.", form: "Form 5" },
      { id: "fr-near-online",label: "Solicitud con reglas Near Online", desc: "Crear reglas de negocio en el entorno Near Online.", form: "Form 6" },
      { id: "fr-online",     label: "Solicitud con reglas Online", desc: "Crear reglas de negocio en el entorno Online.", form: "Form 6" },
      { id: "fr-tenant",     label: "Creación Tenant Bre-B", desc: "Creación de tenant de producción para gestión de fraude en Bre-B.", form: "Form 4" }
    ]
  },
  {
    id: "facturacion",
    label: "Facturación",
    icon: ICONS.facturacion,
    options: [
      { id: "fa-desacuerdo", label: "Desacuerdo en valores facturados", desc: "El valor cobrado no coincide con lo esperado por errores en tarifas o descuentos.", form: "Form 2" },
      { id: "fa-detalle",    label: "Detalle y o aclaración facturacion", desc: "Solicitud para el desglose o soporte del valor facturado.", form: "Form 2" },
      { id: "fa-no-factura", label: "No recepcion factura", desc: "No se ha recibido la factura en el tiempo esperado.", form: "Form 2" }
    ]
  },
  {
    id: "implementaciones",
    label: "Implementaciones",
    icon: ICONS.implementaciones,
    options: [
      { id: "im-breb", label: "Implementación BreB", desc: "Asesoría para implementar casos de uso y pruebas en BreB.", form: "Form 7" }
    ]
  },
  {
    id: "legal",
    label: "Legal",
    icon: ICONS.legal,
    options: [
      { id: "le-peticion", label: "Derecho de petición", desc: "Solicitud formal dirigida a la Superintendencia.", form: "Form 7" }
    ]
  },
  {
    id: "monitoreo",
    label: "Monitoreo Transaccional",
    icon: ICONS.monitoreo,
    options: [
      { id: "mo-asesoria",    label: "Asesoría técnica a entidad", desc: "Consulta sobre monitoreo o niveles de servicio por novedades.", form: "Form 7" },
      { id: "mo-falla",       label: "Falla en servicio transaccional", desc: "Problemas de acceso, lentitud o caída del sistema.", form: "Form 1" },
      { id: "mo-negacion",    label: "Generación de Reportes Monitoreo", desc: "Análisis solicitado por aumento en transacciones negadas.", form: "Form 5" },
      { id: "mo-reporte-ins", label: "Reporte de monitoreo INS", desc: "Generación de reportes por ambiente, dispositivo, emisores, llaves, etc.", form: "Form 5" }
    ]
  }
];

/* ============================================================
   Consultar estado · tickets de ejemplo y opciones de filtro
   ============================================================ */
/* La columna "novedad" solo aplica a solicitudes de formularios con
   variante Unitaria/Masiva (Form 3, 4, 8, 9). Las demás quedan en "".
   Campos del detalle del ticket:
   - titulo, escalado        → cabecera del panel
   - adjuntos: [{name}]       → archivos subidos por el solicitante (descargables)
   - comentarios: [{area,fecha,usuario,texto}] → línea de tiempo
   - solucion: {de, texto, adjuntos:[{name}], cierre} | null
*/
const SOL_TEXT = `Reciba un cordial saludo.\n\nEn respuesta a su solicitud Q22-18394, informamos que compartimos el detalle de su solicitud de la siguiente forma:\n\n1. Revisar su bandeja de entrada, donde encontrará 2 correos seguros desde la cuenta atiencion@credibanco.com.\n2. Copiar la contraseña que viene en uno de los correos.\n\nO puede consultar el estado de la transacción en el reporte unificado y verá el tipo de transacción como "Reverso".`;

const TICKETS = [
  { ticket: "12345", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Comercio A", ans: "A tiempo", novedad: "Unitaria", categoria: "Operaciones",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Aclaración de resultado de transacción", escalado: "Usuario",
    adjuntos: [{ name: "evidencia.png" }, { name: "soporte.pdf" }],
    comentarios: [],
    solucion: null },

  { ticket: "12346", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Julian Velasquez", ans: "Por vencer", novedad: "Masiva", categoria: "Llaves",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Aclaración de resultado de transacción", escalado: "Usuario",
    adjuntos: [{ name: "lote_llaves.xlsx" }],
    comentarios: [
      { area: "Operaciones", fecha: "21/01/2026 - 09:00 AM", usuario: "Operaciones", texto: "Se recibe la información. En revisión para análisis del caso." }
    ],
    solucion: null },

  { ticket: "12347", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Carlos Guzman", ans: "Vencido", novedad: "", categoria: "Errores Tecnicos",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Fallas con los servicios API", escalado: "Soporte técnico",
    adjuntos: [],
    comentarios: [
      { area: "Operaciones", fecha: "20/01/2026 - 02:00 PM", usuario: "SAP", texto: "Producto o servicio no cubierto, se necesita más información." }
    ],
    solucion: null },

  { ticket: "12348", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "Resuelto", solicitante: "Operaciones CCO", ans: "Vencido", novedad: "", categoria: "Monitoreo del fraude",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Aclaración de resultado de transacción", escalado: "Usuario",
    adjuntos: [{ name: "pantallazo.jpg" }],
    comentarios: [
      { area: "Operaciones", fecha: "21/01/2026 - 09:00 AM", usuario: "Operaciones", texto: "Se recibe la información. En revisión para análisis del caso." }
    ],
    solucion: { de: "hubconnect@credibanco.com", texto: SOL_TEXT, adjuntos: [{ name: "respuesta.pdf" }], cierre: "16/08/2026" } },

  { ticket: "12349", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Comercio B", ans: "A tiempo", novedad: "Unitaria", categoria: "Operaciones",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Aclaración de resultado de transacción", escalado: "Usuario",
    adjuntos: [{ name: "comprobante.png" }, { name: "detalle.jpg" }],
    comentarios: [], solucion: null },

  { ticket: "12350", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Camila Martinez", ans: "Por vencer", novedad: "", categoria: "Facturación",
    titulo: "Desacuerdo en valores facturados", subtitulo: "Facturación", escalado: "Usuario",
    adjuntos: [{ name: "factura.pdf" }], comentarios: [], solucion: null },

  { ticket: "12351", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Comercio C", ans: "A tiempo", novedad: "Masiva", categoria: "Operaciones",
    titulo: "Apoyo cuadre compensación", subtitulo: "Operaciones", escalado: "Usuario",
    adjuntos: [], comentarios: [], solucion: null },

  { ticket: "12352", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "Resuelto", solicitante: "Comercio C", ans: "Vencido", novedad: "Masiva", categoria: "Llaves",
    titulo: "Historial de llaves por entidad", subtitulo: "Llaves", escalado: "Usuario",
    adjuntos: [{ name: "reporte_llaves.xlsx" }],
    comentarios: [
      { area: "Operaciones", fecha: "20/01/2026 - 02:00 PM", usuario: "SAP", texto: "Producto o servicio no cubierto, se necesita más información." }
    ],
    solucion: { de: "hubconnect@credibanco.com", texto: SOL_TEXT, adjuntos: [], cierre: "16/08/2026" } },

  { ticket: "12353", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Comercio e", ans: "Por vencer", novedad: "", categoria: "Facturación",
    titulo: "No recepción factura", subtitulo: "Facturación", escalado: "Usuario",
    adjuntos: [], comentarios: [], solucion: null },

  { ticket: "12354", creacion: "2025-03-25 11:53:50", vencimiento: "2025-03-28 11:53:50", estado: "En proceso", solicitante: "Andrea Perez", ans: "A tiempo", novedad: "Unitaria", categoria: "Operaciones",
    titulo: "Reversar unidad transacción(es)", subtitulo: "Aclaración de resultado de transacción", escalado: "Usuario",
    adjuntos: [], comentarios: [], solucion: null }
];

const FILTER_OPTIONS = {
  estado:     ["En proceso", "Resuelto"],
  categoria:  ["Operaciones", "Llaves", "Errores Tecnicos", "Monitoreo del fraude", "Facturación"],
  solicitante:["Andrea Perez", "Harold Mazuera", "Marcos Antonio", "Comercio A", "Julian Velasquez", "Carlos Guzman"],
  novedad:    ["Unitaria", "Masiva"],
  ans:        ["Vencido", "A tiempo", "Por vencer"]
};


/* ============================================================
   Definición de formularios (campos) por número de "Form".
   Tipos de campo soportados por el renderizador (app.js):
   - text      : input de texto (admite maxLength, placeholder)
   - date      : input tipo fecha (DD/MM/AAAA)
   - select    : lista desplegable (options: [...])
   - textarea  : área de texto (maxLength, con contador)
   - file      : carga de archivos (accept, max, note)
   - template  : aviso + botón "Descargar plantilla"
   - row       : agrupa campos en una fila de 2 columnas (fields: [...])
   Campos con "requerido: true" muestran asterisco y se validan.
   Formularios con "variants" cambian según la "Novedad" (Unitaria/Masiva).
   ============================================================ */

const OPT_AMBIENTE   = ["Pruebas", "Producción"];
const OPT_FRECUENCIA = ["Siempre", "Intermitente", "Una sola vez"];
const OPT_TIPO_LLAVE = ["ALPHANUMERIC", "PHONE", "MERCHANT_CODE", "MAIL", "IDENTIFICATION"];
const OPT_GESTION    = ["Crear", "Modificar", "Eliminar", "Actualizar"];
const OPT_REGLAS     = ["Alertamiento", "Declinación"];
const OPT_TIPO_OP    = ["Devolución", "Transacción"];
const OPT_ESTADO_DEV = ["Llave Errada", "Fraude, Estafa, No Reconoce la TRX"];
const OPT_CAUSA_CONC = ["No recibió archivo", "Archivo incorrecto", "Errores en el archivo", "Otro"];

const FORMS = {
  /* ---------- Form 1: Incidentes y fallas técnicas ---------- */
  "Form 1": {
    fields: [
      { type: "row", fields: [
        { type: "date", id: "periodo", label: "Periodo no facturado", requerido: true },
        { type: "timerange", id: "horaReporte", label: "Rango de hora para el reporte" }
      ]},
      { type: "row", fields: [
        { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE },
        { type: "select", id: "frecuencia", label: "Frecuencia del error", requerido: true, options: OPT_FRECUENCIA }
      ]},
      { type: "text", id: "codigo", label: "Código del error Recibido", placeholder: "Ej: 1234", maxLength: 50 },
      { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
      { type: "file", id: "soportes", label: "Carga el mensaje del error mostrado (Carga máximo 3 archivos)", accept: ".jpg,.png", acceptLabel: "JPG, PNG", max: 3 }
    ]
  },

  /* ---------- Form 2: Facturación ---------- */
  "Form 2": {
    fields: [
      { type: "date", id: "periodo", label: "Periodo a analizar", requerido: true },
      { type: "row", fields: [
        { type: "text", id: "numFactura", label: "Número de factura", placeholder: "Ej: 1234", maxLength: 50 },
        { type: "text", id: "valor", label: "Valor cuestionado", placeholder: "Ej: 1234", maxLength: 50 }
      ]},
      { type: "text", id: "rubro", label: "Rubro", requerido: true, placeholder: "Ej: 1234", maxLength: 50 },
      { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
      { type: "file", id: "soportes", label: "Carga el mensaje del error mostrado (Carga máximo 3 archivos)", accept: ".jpg,.pdf,.png", acceptLabel: "JPG, PDF o PNG", max: 3 }
    ]
  },

  /* ---------- Form 3: Llaves (Unitaria / Masiva) ---------- */
  "Form 3": {
    variants: {
      label: "Novedad",
      options: ["Unitaria", "Masiva"],
      Unitaria: [
        { type: "row", fields: [
          { type: "date", id: "fecha", label: "Fecha", requerido: true },
          { type: "timerange", id: "hora", label: "Rango de hora para el reporte" }
        ]},
        { type: "row", fields: [
          { type: "text", id: "llave", label: "Llave", requerido: true, placeholder: "Ej: 1234", maxLength: 100 },
          { type: "select", id: "tipoLlave", label: "Tipo de llave", requerido: true, options: OPT_TIPO_LLAVE }
        ]},
        { type: "row", fields: [
          { type: "text", id: "identificacion", label: "Identificación del cliente", requerido: true, placeholder: "Ej: 1234", maxLength: 20 },
          { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE }
        ]},
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "soportes", label: "Carga el mensaje del error mostrado (Carga máximo 3 archivos)", accept: ".pdf,.jpg,.png", acceptLabel: "PDF, JPG, PNG", max: 3 }
      ],
      Masiva: [
        { type: "template", id: "plantilla", file: "Reporte_llaves_masivo.xlsx" },
        { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE },
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "adjunto", label: "Adjuntar plantilla", requerido: true, accept: ".xls,.xlsx", acceptLabel: "XLS, XLSX", max: 1, scan: true }
      ]
    }
  },

  /* ---------- Form 4: Usuarios y accesos (Unitaria / Masiva) ---------- */
  "Form 4": {
    variants: {
      label: "Novedad",
      options: ["Unitaria", "Masiva"],
      Unitaria: [
        { type: "row", fields: [
          { type: "text", id: "nombre", label: "Nombre usuario", requerido: true, placeholder: "Ej: 1234" },
          { type: "text", id: "numId", label: "Número de identificación", requerido: true, placeholder: "Ej: 1234", maxLength: 20 }
        ]},
        { type: "text", id: "correo", label: "Correo electrónico", requerido: true, placeholder: "Ej: tesoreria@banco.com" },
        { type: "row", fields: [
          { type: "text", id: "plataforma", label: "Plataforma", requerido: true, placeholder: "Ej: 1234" },
          { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE }
        ]},
        { type: "row", fields: [
          { type: "select", id: "gestion", label: "Tipo de gestión", requerido: true, options: OPT_GESTION },
          { type: "text", id: "nit", label: "Nit", requerido: true, placeholder: "Ej: 1234", maxLength: 15 }
        ]},
        { type: "row", fields: [
          { type: "text", id: "rol", label: "Rol en la herramienta", requerido: true, placeholder: "Ej: 1234" },
          { type: "text", id: "ip", label: "IP", requerido: true, placeholder: "Ej: 1234", maxLength: 20 }
        ]},
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 }
      ],
      Masiva: [
        { type: "template", id: "plantilla", file: "Usuarios_y_accesos.xlsx" },
        { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE },
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "adjunto", label: "Adjuntar plantilla", requerido: true, accept: ".xls,.xlsx", acceptLabel: "XLS, XLSX", max: 1, scan: true }
      ]
    }
  },

  /* ---------- Form 5: Solicitud de reportes ---------- */
  "Form 5": {
    fields: [
      { type: "date", id: "fechaReporte", label: "Fecha Reporte", requerido: true },
      { type: "textarea", id: "descripcion", label: "Descripción del reporte", requerido: true, maxLength: 2000, placeholder: "Detalla todos los datos del reporte." }
    ]
  },

  /* ---------- Form 6: Reglas ---------- */
  "Form 6": {
    fields: [
      { type: "select", id: "solicitudReglas", label: "Solicitud de reglas", requerido: true, options: OPT_REGLAS },
      { type: "textarea", id: "solicitud", label: "¿Cuéntanos tu solicitud?", requerido: true, maxLength: 2000, placeholder: "Detalla todos los datos de tu solicitud." }
    ]
  },

  /* ---------- Form 7: Asesorías ---------- */
  "Form 7": {
    fields: [
      { type: "textarea", id: "solicitud", label: "¿Cuéntanos tu solicitud?", requerido: true, maxLength: 2000, placeholder: "Detalla todos los datos de tu solicitud." },
      { type: "file", id: "soportes", label: "Soportes (Carga máximo 3 archivos)", accept: ".pdf,.jpg,.png", acceptLabel: "PDF, JPG, PNG", max: 3 }
    ]
  },

  /* ---------- Form 8: Conciliación (Unitaria / Masiva) ---------- */
  "Form 8": {
    variants: {
      label: "Novedad",
      options: ["Unitaria", "Masiva"],
      Unitaria: [
        { type: "row", fields: [
          { type: "date", id: "fecha", label: "Fecha", requerido: true },
          { type: "select", id: "causa", label: "Causa", requerido: true, options: OPT_CAUSA_CONC, placeholder: "Seleccione una opción" }
        ]},
        { type: "text", id: "nombreArchivo", label: "Nombre del archivo de conciliación", requerido: true, placeholder: "Ej: 1234" },
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "soportes", label: "Soportes (Carga máximo 3 archivos)", accept: ".pdf,.jpg,.png", acceptLabel: "PDF, JPG Y PNG", max: 3 }
      ],
      Masiva: [
        { type: "template", id: "plantilla", file: "Conciliación_Masivo.xlsx" },
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "adjunto", label: "Adjuntar plantilla", requerido: true, accept: ".xls,.xlsx", acceptLabel: "XLS, XLSX", max: 1, scan: true }
      ]
    }
  },

  /* ---------- Form 9: Transacciones (Unitaria / Masiva) ---------- */
  "Form 9": {
    variants: {
      label: "Novedad",
      options: ["Unitaria", "Masiva"],
      Unitaria: [
        { type: "row", fields: [
          { type: "date", id: "fecha", label: "Fecha", requerido: true },
          { type: "timerange", id: "hora", label: "Rango de hora para el reporte" }
        ]},
        { type: "row", fields: [
          { type: "text", id: "idTransaccion", label: "Identificador de la transacción", requerido: true, placeholder: "Ej: 1234", maxLength: 35 },
          { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE }
        ]},
        { type: "row", fields: [
          { type: "text", id: "valor", label: "Valor", requerido: true, placeholder: "Ej: 1234", maxLength: 10 },
          { type: "text", id: "codigoUnico", label: "Código Único", requerido: true, placeholder: "Ej: 1234", maxLength: 10 }
        ]},
        { type: "row", fields: [
          { type: "select", id: "tipoOperacion", label: "Tipo de operación", requerido: true, options: OPT_TIPO_OP },
          { type: "select", id: "estadoDev", label: "Estado Devolución", options: OPT_ESTADO_DEV, showIf: { field: "tipoOperacion", equals: "Devolución" }, requeridoIf: true }
        ]},
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "soportes", label: "Soportes (Carga máximo 3 archivos)", accept: ".pdf,.jpg,.png", acceptLabel: "PDF, JPG, PNG", max: 3 }
      ],
      Masiva: [
        { type: "template", id: "plantilla", file: "Reporte_TRX_Masivo.xlsx" },
        { type: "select", id: "ambiente", label: "Elige el ambiente", requerido: true, options: OPT_AMBIENTE },
        { type: "textarea", id: "problema", label: "¿Cuéntanos tu problema?", requerido: true, maxLength: 2000 },
        { type: "file", id: "adjunto", label: "Adjuntar plantilla", requerido: true, accept: ".xls,.xlsx", acceptLabel: "XLS, XLSX", max: 1, scan: true }
      ]
    }
  }
};
