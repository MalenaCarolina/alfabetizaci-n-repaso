/* =============================================================================
 *  vistas.js  —  Render compartido de resultados (docente + estudiante)
 * ========================================================================== */

import { OPCIONES_DEBATE, OPCIONES_SI_NO } from "./config.js";
import { escaparHTML } from "./utils.js";


/* ===========================================================================
 *  BARRAS ANIMADAS (para preguntas tipo "debate" y "siNo")
 * ========================================================================== */
export function renderBarras(contenedor, respuestas, tipo = "debate") {
  const opciones = tipo === "siNo" ? OPCIONES_SI_NO : OPCIONES_DEBATE;
  const total = respuestas.length;

  const conteo = {};
  opciones.forEach((o) => { conteo[o.clave] = 0; });
  respuestas.forEach((r) => { if (conteo[r.opcion] != null) conteo[r.opcion]++; });

  contenedor.innerHTML = opciones.map((op) => {
    const n = conteo[op.clave];
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `
      <div class="resultado" data-clave="${op.clave}">
        <div class="encabezado">
          <span class="nombre-opcion"><span aria-hidden="true">${op.emoji}</span> ${op.texto}</span>
          <span class="cifras"><b>${n}</b> · ${pct}%</span>
        </div>
        <div class="pista"><div class="barra" data-pct="${pct}"></div></div>
      </div>`;
  }).join("");

  requestAnimationFrame(() => {
    contenedor.querySelectorAll(".barra").forEach((b) => {
      b.style.width = b.dataset.pct + "%";
    });
  });
}


/* ===========================================================================
 *  RESULTADOS DE SELECCIÓN MÚLTIPLE
 * ========================================================================== */
export function renderMultiple(contenedor, respuestas, opciones) {
  // Cada respuesta tiene r.opciones = [ "texto A", "texto B", ... ]
  const conteo = {};
  opciones.forEach((o) => { conteo[o] = 0; });

  let total = 0;
  respuestas.forEach((r) => {
    const elegidas = Array.isArray(r.opciones) ? r.opciones : [];
    elegidas.forEach((o) => { if (conteo[o] != null) conteo[o]++; });
    if (elegidas.length > 0) total++;
  });

  contenedor.innerHTML = opciones.map((texto) => {
    const n = conteo[texto] || 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `
      <div class="resultado" data-clave="multiple">
        <div class="encabezado">
          <span class="nombre-opcion">${escaparHTML(texto)}</span>
          <span class="cifras"><b>${n}</b> · ${pct}%</span>
        </div>
        <div class="pista"><div class="barra" data-pct="${pct}"></div></div>
      </div>`;
  }).join("");

  requestAnimationFrame(() => {
    contenedor.querySelectorAll(".barra").forEach((b) => {
      b.style.width = b.dataset.pct + "%";
    });
  });
}


/* ===========================================================================
 *  RESPUESTAS DE DESARROLLO LIBRE (tarjetas de texto)
 * ========================================================================== */
export function renderDesarrollo(contenedor, respuestas, mostrarNombres) {
  const conTexto = respuestas.filter((r) => (r.respuesta || "").trim());

  if (!conTexto.length) {
    contenedor.innerHTML = `<p class="subtitulo" style="font-size:.92rem;">Todavía no hay respuestas para mostrar.</p>`;
    return;
  }

  contenedor.innerHTML = conTexto.map((r) => `
    <div class="tarjeta-justificacion">
      <div class="texto">"${escaparHTML(r.respuesta.trim())}"</div>
      ${mostrarNombres ? `<div class="autor">— ${escaparHTML(r.nombre || "Anónimo")}</div>` : ""}
    </div>`).join("");
}


/* ===========================================================================
 *  JUSTIFICACIONES (para debate y siNo)
 * ========================================================================== */
export function renderJustificaciones(contenedor, respuestas, mostrarNombres) {
  const conTexto = respuestas.filter((r) => (r.justificacion || "").trim());

  if (!conTexto.length) {
    contenedor.innerHTML = `<p class="subtitulo" style="font-size:.92rem;">Todavía no hay justificaciones para mostrar.</p>`;
    return;
  }

  contenedor.innerHTML = conTexto.map((r) => `
    <div class="tarjeta-justificacion" data-clave="${r.opcion}">
      <div class="texto">"${escaparHTML(r.justificacion.trim())}"</div>
      ${mostrarNombres ? `<div class="autor">— ${escaparHTML(r.nombre || "Anónimo")}</div>` : ""}
    </div>`).join("");
}

