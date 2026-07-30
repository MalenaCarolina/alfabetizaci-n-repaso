/* =============================================================================
 *  utils.js  —  Utilidades compartidas por el panel docente y el estudiante
 * -----------------------------------------------------------------------------
 *  Funciones chicas y reutilizables: generar códigos e ids, formatear tiempos,
 *  cambiar de tema, pantalla completa, dibujar el QR, mostrar avisos y exportar
 *  los resultados a CSV / Excel / JSON. Nada de esto habla con Firestore.
 * ========================================================================== */

import { OPCIONES_DEBATE, OPCIONES_SI_NO } from "./config.js";

/* --- Diccionario opción → texto legible (ej. "acuerdo" → "De acuerdo") ------ */
const TEXTO_OPCION = Object.fromEntries(
  [...OPCIONES_DEBATE, ...OPCIONES_SI_NO].map((o) => [o.clave, o.texto])
);
export const textoDeOpcion = (clave) => TEXTO_OPCION[clave] ?? clave;


/* ============================ Identificadores ============================== */

/**
 * Genera un código de sala corto y legible (sin letras/números que se
 * confundan: 0/O, 1/I). Ej: "K7QP2".
 */
export function generarCodigoSala(longitud = 5) {
  const abecedario = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < longitud; i++) {
    codigo += abecedario[Math.floor(Math.random() * abecedario.length)];
  }
  return codigo;
}

/** Genera un id único para cada participante (persiste en el navegador). */
export function generarId() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}


/* =============================== Formato =================================== */

/** Convierte milisegundos a un texto tipo "48 s" o "1 min 12 s". */
export function formatearTiempo(ms) {
  if (!ms || ms < 0) return "—";
  const seg = Math.round(ms / 1000);
  if (seg < 60) return `${seg} s`;
  const min = Math.floor(seg / 60);
  return `${min} min ${seg % 60} s`;
}

/** Escapa texto para insertarlo como HTML sin riesgo de inyección. */
export function escaparHTML(texto = "") {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/** Mezcla un arreglo al azar (algoritmo de Fisher–Yates). Devuelve copia nueva. */
export function mezclarArreglo(arreglo) {
  const copia = [...arreglo];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}


/* =============================== Tema (claro/oscuro) ======================= */

/**
 * Aplica el tema guardado (o el del sistema) y devuelve una función para
 * alternar. Guarda la preferencia en localStorage.
 */
export function inicializarTema(botonAlternar) {
  const guardado = localStorage.getItem("tema");
  const prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const aplicar = (tema) => {
    document.documentElement.dataset.tema = tema;
    if (botonAlternar) {
      botonAlternar.setAttribute("aria-pressed", tema === "oscuro");
      botonAlternar.title = tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    }
  };
  aplicar(guardado || (prefiereOscuro ? "oscuro" : "claro"));

  if (botonAlternar) {
    botonAlternar.addEventListener("click", () => {
      const nuevo = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
      localStorage.setItem("tema", nuevo);
      aplicar(nuevo);
    });
  }
}


/* ============================ Pantalla completa =========================== */

export function alternarPantallaCompleta() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}


/* ================================ Avisos ================================== */

/** Muestra un aviso flotante breve (toast) accesible. */
export function avisar(mensaje) {
  let cont = document.querySelector(".avisos");
  if (!cont) {
    cont = document.createElement("div");
    cont.className = "avisos";
    cont.setAttribute("role", "status");
    cont.setAttribute("aria-live", "polite");
    document.body.appendChild(cont);
  }
  const aviso = document.createElement("div");
  aviso.className = "aviso";
  aviso.textContent = mensaje;
  cont.appendChild(aviso);
  // Se retira solo después de la animación.
  setTimeout(() => aviso.classList.add("saliendo"), 2600);
  setTimeout(() => aviso.remove(), 3100);
}

/** Copia texto al portapapeles con respaldo para navegadores viejos. */
export async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement("textarea");
    t.value = texto;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}


/* ================================== QR ==================================== */

/**
 * Dibuja un código QR dentro de un contenedor.
 * Usa la librería qrcodejs cargada por <script> (window.QRCode).
 */
export function dibujarQR(contenedor, url, tamano = 220) {
  contenedor.innerHTML = "";
  if (typeof window.QRCode === "undefined") {
    contenedor.textContent = "No se pudo cargar el generador de QR.";
    return;
  }
  new window.QRCode(contenedor, {
    text: url,
    width: tamano,
    height: tamano,
    colorDark: "#111318",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.M
  });
}


/* =============================== Exportar ================================= */

/**
 * Arma las filas de datos a partir de las respuestas crudas.
 * Cada fila es lo que pide la consigna: nombre, fecha, hora, número y texto de
 * la afirmación, respuesta, justificación y tiempo que tardó.
 */
export function armarFilas(respuestas, preguntas = []) {
  return respuestas
    .slice()
    .sort((a, b) => (a.indice - b.indice) || 0)
    .map((r) => {
      const fecha = r.creadaEn?.toDate ? r.creadaEn.toDate() : new Date();
      const tipo = r.tipoPregunta || "debate";

      // "Respuesta" varía según el tipo
      let respuesta = "";
      if (tipo === "debate" || tipo === "siNo") {
        respuesta = textoDeOpcion(r.opcion);
      } else if (tipo === "multiple") {
        respuesta = Array.isArray(r.opciones) ? r.opciones.join(" | ") : "";
      } else if (tipo === "desarrollo") {
        respuesta = r.respuesta || "";
      }

      // "Justificación" solo aplica a debate/siNo
      const justificacion = (tipo === "debate" || tipo === "siNo") ? (r.justificacion || "") : "";

      return {
        "Nombre":       r.nombre || "",
        "Fecha":        fecha.toLocaleDateString("es-AR"),
        "Hora":         fecha.toLocaleTimeString("es-AR"),
        "N° pregunta":  r.indice + 1,
        "Tipo":         tipo,
        "Pregunta":     r.textoPregunta || "",
        "Respuesta":    respuesta,
        "Justificación": justificacion,
        "Tiempo (s)":   r.tiempoMs ? Math.round(r.tiempoMs / 1000) : ""
      };
    });
}

/** Fuerza la descarga de un archivo (Blob) con el nombre indicado. */
function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Exporta las filas a CSV (compatible con Excel, con BOM para acentos). */
export function exportarCSV(filas, nombre = "respuestas.csv") {
  if (!filas.length) return;
  const cabeceras = Object.keys(filas[0]);
  const escapar = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lineas = [
    cabeceras.map(escapar).join(","),
    ...filas.map((f) => cabeceras.map((c) => escapar(f[c])).join(","))
  ];
  // El "\uFEFF" (BOM) hace que Excel muestre bien los acentos.
  const blob = new Blob(["\uFEFF" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, nombre);
}

/** Exporta las filas a JSON. */
export function exportarJSON(filas, nombre = "respuestas.json") {
  const blob = new Blob([JSON.stringify(filas, null, 2)], { type: "application/json" });
  descargarBlob(blob, nombre);
}

/**
 * Exporta a Excel (.xlsx) usando SheetJS si está disponible (window.XLSX).
 * Si por algún motivo no cargó, cae de forma elegante al CSV.
 */
export function exportarExcel(filas, nombre = "respuestas.xlsx") {
  if (!filas.length) return;
  if (typeof window.XLSX === "undefined") {
    avisar("No se pudo cargar Excel; descargo CSV en su lugar.");
    exportarCSV(filas, nombre.replace(/\.xlsx$/, ".csv"));
    return;
  }
  const hoja = window.XLSX.utils.json_to_sheet(filas);
  const libro = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(libro, hoja, "Respuestas");
  window.XLSX.writeFile(libro, nombre);
}
