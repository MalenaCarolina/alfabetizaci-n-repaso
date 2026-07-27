/* =============================================================================
 *  vistas.js  —  Render compartido de resultados
 * -----------------------------------------------------------------------------
 *  Las barras y las tarjetas de justificación se ven igual para la docente y
 *  para las estudiantes, así que el código vive acá una sola vez.
 * ========================================================================== */

import { OPCIONES } from "./config.js";
import { escaparHTML } from "./utils.js";

/**
 * Dibuja el gráfico de barras animado para una afirmación.
 * @param {HTMLElement} contenedor  Dónde insertar las barras.
 * @param {Array} respuestas        Respuestas SOLO de esa afirmación.
 */
export function renderBarras(contenedor, respuestas) {
  const total = respuestas.length;

  // Contamos cuántas respuestas hay por cada opción.
  const conteo = { acuerdo: 0, depende: 0, desacuerdo: 0 };
  respuestas.forEach((r) => { if (conteo[r.opcion] != null) conteo[r.opcion]++; });

  contenedor.innerHTML = OPCIONES.map((op) => {
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

  // Animamos el ancho en el siguiente cuadro para que se dispare la transición.
  requestAnimationFrame(() => {
    contenedor.querySelectorAll(".barra").forEach((b) => {
      b.style.width = b.dataset.pct + "%";
    });
  });
}

/**
 * Dibuja las justificaciones como tarjetas.
 * @param {HTMLElement} contenedor
 * @param {Array} respuestas        Respuestas de esa afirmación.
 * @param {boolean} mostrarNombres  Si true, muestra el autor; si no, anónimas.
 */
export function renderJustificaciones(contenedor, respuestas, mostrarNombres) {
  const conTexto = respuestas.filter((r) => (r.justificacion || "").trim());

  if (!conTexto.length) {
    contenedor.innerHTML = `<p class="subtitulo" style="font-size:.92rem;">Todavía no hay justificaciones para mostrar.</p>`;
    return;
  }

  contenedor.innerHTML = conTexto.map((r) => `
    <div class="tarjeta-justificacion" data-clave="${r.opcion}">
      <div class="texto">“${escaparHTML(r.justificacion.trim())}”</div>
      ${mostrarNombres ? `<div class="autor">— ${escaparHTML(r.nombre || "Anónimo")}</div>` : ""}
    </div>`).join("");
}
