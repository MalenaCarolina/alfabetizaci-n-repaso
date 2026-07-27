/* =============================================================================
 *  docente.js  —  Lógica del panel de la docente
 * -----------------------------------------------------------------------------
 *  Crea la sala, muestra el código y el QR, sigue en vivo a las participantes,
 *  controla el ritmo (una afirmación por vez, cerrar respuestas, mostrar
 *  resultados) y al final arma el resumen y permite exportar.
 * ========================================================================== */

import { AFIRMACIONES, AJUSTES_DEFECTO } from "./config.js";
import {
  crearSala, obtenerSala, actualizarSala,
  escucharSala, escucharParticipantes, escucharRespuestas
} from "./firebase.js";
import {
  inicializarTema, alternarPantallaCompleta, avisar,
  generarCodigoSala, mezclarArreglo, dibujarQR, copiarAlPortapapeles,
  formatearTiempo, armarFilas, exportarCSV, exportarExcel, exportarJSON, escaparHTML
} from "./utils.js";
import { renderBarras, renderJustificaciones } from "./vistas.js";

/* ---------------------------- Estado local ------------------------------- */
let codigo = null;
let sala = null;
let participantes = [];
let respuestas = [];
let timerBloqueo = null;   // para cerrar automáticamente al vencer el tiempo

const $ = (id) => document.getElementById(id);

/* ---------------------------- Arranque ----------------------------------- */
inicializarTema($("btn-tema"));
$("btn-pantalla").addEventListener("click", alternarPantallaCompleta);
$("cant-afirmaciones").textContent = AFIRMACIONES.length;

// Si había una sala en curso (por si se recargó la página), la retomamos.
const guardado = localStorage.getItem("salaDocente");
if (guardado) reanudar(guardado);

$("btn-crear").addEventListener("click", crear);

/* ============================ Crear la sala ============================== */
async function crear() {
  codigo = generarCodigoSala();

  // Tomamos las afirmaciones (mezcladas si se pidió).
  const mezclar = $("cfg-mezclar").checked;
  const afirmaciones = mezclar ? mezclarArreglo(AFIRMACIONES) : [...AFIRMACIONES];

  const config = {
    afirmaciones,
    mezclarAfirmaciones: mezclar,
    permitirSeudonimo: $("cfg-seudonimo").checked,
    mostrarNombres: $("cfg-nombres").checked,
    permitirEdicion: $("cfg-editar").checked,
    segundosTemporizador: Math.max(0, parseInt($("cfg-timer").value, 10) || 0)
  };

  $("btn-crear").disabled = true;
  $("btn-crear").textContent = "Creando…";
  try {
    await crearSala(codigo, config);
    localStorage.setItem("salaDocente", codigo);
    abrirActividad();
  } catch (e) {
    avisar("No se pudo crear la sala. Revisá las claves de Firebase (config.js).");
    console.error(e);
    $("btn-crear").disabled = false;
    $("btn-crear").textContent = "Crear sala";
  }
}

/* Retoma una sala existente tras recargar la página. */
async function reanudar(cod) {
  const datos = await obtenerSala(cod);
  if (!datos || datos.estado === "final") { localStorage.removeItem("salaDocente"); return; }
  codigo = cod;
  abrirActividad();
}

/* Pasa de la pantalla de creación a la de actividad y engancha los listeners. */
function abrirActividad() {
  $("vista-crear").classList.add("oculto");
  $("vista-actividad").classList.remove("oculto");

  // Código, enlace y QR.
  const url = new URL(`estudiante.html?sala=${codigo}`, location.href).href;
  $("codigo-sala").textContent = codigo;
  $("link-estudiante").href = url;
  dibujarQR($("qr"), url, 150);
  $("btn-copiar").addEventListener("click", async () => {
    await copiarAlPortapapeles(url);
    avisar("Enlace copiado.");
  });

  conectarControles();

  // Escuchas en tiempo real.
  escucharSala(codigo, (d) => { sala = d; render(); });
  escucharParticipantes(codigo, (l) => { participantes = l; render(); });
  escucharRespuestas(codigo, (l) => { respuestas = l; render(); });
}

/* ======================= Botones del panel de control =================== */
function conectarControles() {
  // Iniciar: pasa de la sala de espera a la primera afirmación.
  $("ctrl-iniciar").onclick = () => irAAfirmacion(0);

  // Cerrar / reabrir respuestas de la afirmación actual.
  $("ctrl-bloquear").onclick = () => actualizarSala(codigo, { bloqueada: !sala.bloqueada });

  // Mostrar / ocultar resultados para toda la clase.
  $("ctrl-resultados").onclick = () => {
    const nuevo = sala.estado === "resultados" ? "pregunta" : "resultados";
    actualizarSala(codigo, { estado: nuevo });
  };

  // Mostrar / ocultar las justificaciones.
  $("ctrl-justificaciones").onclick = () =>
    actualizarSala(codigo, { mostrarJustificaciones: !sala.mostrarJustificaciones });

  // Permitir / bloquear la edición de respuestas.
  $("ctrl-editar").onclick = () =>
    actualizarSala(codigo, { permitirEdicion: !sala.permitirEdicion });

  // Siguiente afirmación (o finalizar si era la última).
  $("ctrl-siguiente").onclick = () => {
    const siguiente = sala.indiceActual + 1;
    if (siguiente < sala.afirmaciones.length) irAAfirmacion(siguiente);
    else finalizar();
  };

  $("ctrl-finalizar").onclick = finalizar;

  // Exportaciones (disponibles en cualquier momento).
  $("exp-csv").onclick   = () => exportarCSV(armarFilas(respuestas), `alfabetizacion-${codigo}.csv`);
  $("exp-excel").onclick = () => exportarExcel(armarFilas(respuestas), `alfabetizacion-${codigo}.xlsx`);
  $("exp-json").onclick  = () => exportarJSON(armarFilas(respuestas), `alfabetizacion-${codigo}.json`);

  $("fin-csv").onclick   = () => exportarCSV(armarFilas(respuestas), `alfabetizacion-${codigo}.csv`);
  $("fin-excel").onclick = () => exportarExcel(armarFilas(respuestas), `alfabetizacion-${codigo}.xlsx`);
  $("fin-json").onclick  = () => exportarJSON(armarFilas(respuestas), `alfabetizacion-${codigo}.json`);
}

/* Va a una afirmación: reinicia el estado (abierta, sin resultados, timer nuevo). */
function irAAfirmacion(indice) {
  actualizarSala(codigo, {
    estado: "pregunta",
    indiceActual: indice,
    bloqueada: false,
    inicioPreguntaMs: Date.now()
  });
}

/* Finaliza la actividad y muestra el resumen. */
function finalizar() {
  actualizarSala(codigo, { estado: "final" });
}

/* ============================ Render principal =========================== */
function render() {
  if (!sala) return;

  // Si terminó, mostramos el resumen y limpiamos.
  if (sala.estado === "final") {
    localStorage.removeItem("salaDocente");
    detenerTimerBloqueo();
    mostrarResumen();
    return;
  }

  renderParticipantes();
  renderEstadoActual();
  renderControles();
  gestionarTimerBloqueo();
}

/* ------------------------- Lista de participantes ------------------------ */
function renderParticipantes() {
  const cont = $("lista-participantes");
  $("cont-participantes").textContent = `${participantes.length} en la sala`;
  $("sin-participantes").classList.toggle("oculto", participantes.length > 0);

  // Quiénes ya respondieron la afirmación actual.
  const respondieron = new Set(
    respuestas.filter((r) => r.indice === sala.indiceActual).map((r) => r.idParticipante)
  );

  cont.innerHTML = participantes.map((p) => `
    <span class="ficha ${respondieron.has(p.id) ? "respondio" : ""}">${escaparHTML(p.nombre)}</span>
  `).join("");
}

/* --------------------- Afirmación actual + resultados -------------------- */
function renderEstadoActual() {
  const total = sala.afirmaciones.length;
  const i = sala.indiceActual;
  const enSala = sala.estado === "sala";

  // Encabezado y progreso.
  if (enSala) {
    $("doc-paso").textContent = "Sala de espera";
    $("doc-relleno").style.width = "0%";
    $("doc-afirmacion").textContent = "Cuando estén todas, tocá «Iniciar actividad».";
  } else {
    const etiqueta = sala.estado === "resultados" ? " · resultados" : "";
    $("doc-paso").textContent = `Pregunta ${i + 1} de ${total}${etiqueta}`;
    $("doc-relleno").style.width = `${((i + 1) / total) * 100}%`;
    $("doc-afirmacion").textContent = sala.afirmaciones[i];
  }

  // Contador “X de Y respondieron” (solo con actividad activa).
  const contador = $("doc-contador");
  contador.style.visibility = enSala ? "hidden" : "visible";
  const respondieron = new Set(
    respuestas.filter((r) => r.indice === i).map((r) => r.idParticipante)
  ).size;
  $("doc-respondieron").textContent = respondieron;
  $("doc-total").textContent = participantes.length;

  // Vista previa de resultados: solo cuando están “mostrados”.
  const zona = $("doc-resultados");
  if (sala.estado === "resultados") {
    zona.classList.remove("oculto");
    const deEsta = respuestas.filter((r) => r.indice === i);
    renderBarras($("doc-barras"), deEsta);
    if (sala.mostrarJustificaciones) {
      renderJustificaciones($("doc-justificaciones"), deEsta, sala.mostrarNombres);
      $("doc-justificaciones").classList.remove("oculto");
    } else {
      $("doc-justificaciones").innerHTML = `<p class="subtitulo" style="font-size:.9rem;">Justificaciones ocultas.</p>`;
    }
  } else {
    zona.classList.add("oculto");
  }
}

/* ------------------- Estado/etiquetas de los botones -------------------- */
function renderControles() {
  const enSala = sala.estado === "sala";
  const enResultados = sala.estado === "resultados";
  const esUltima = sala.indiceActual >= sala.afirmaciones.length - 1;

  $("ctrl-iniciar").classList.toggle("oculto", !enSala);
  $("ctrl-siguiente").classList.toggle("oculto", enSala);

  $("ctrl-bloquear").disabled = enSala;
  $("ctrl-bloquear").textContent = sala.bloqueada ? "Reabrir respuestas" : "Cerrar respuestas";

  $("ctrl-resultados").disabled = enSala;
  $("ctrl-resultados").textContent = enResultados ? "Ocultar resultados" : "Mostrar resultados";

  $("ctrl-justificaciones").disabled = enSala;
  $("ctrl-justificaciones").textContent =
    sala.mostrarJustificaciones ? "Ocultar justificaciones" : "Mostrar justificaciones";

  $("ctrl-editar").disabled = enSala;
  $("ctrl-editar").textContent = sala.permitirEdicion ? "Bloquear modificación" : "Permitir modificar";

  $("ctrl-siguiente").textContent = esUltima ? "Finalizar actividad" : "Siguiente afirmación";

  // Exportar solo tiene sentido si ya hay respuestas.
  const hay = respuestas.length > 0;
  ["exp-csv", "exp-excel", "exp-json"].forEach((id) => { $(id).disabled = !hay; });
}

/* ---------------- Cierre automático por temporizador -------------------- */
function gestionarTimerBloqueo() {
  detenerTimerBloqueo();
  const seg = sala.segundosTemporizador;
  if (sala.estado !== "pregunta" || sala.bloqueada || !seg || !sala.inicioPreguntaMs) return;

  const restanteMs = seg * 1000 - (Date.now() - sala.inicioPreguntaMs);
  if (restanteMs <= 0) {
    actualizarSala(codigo, { bloqueada: true });   // ya venció → cerrar
  } else {
    // Programamos el cierre para cuando se cumpla el tiempo.
    timerBloqueo = setTimeout(() => actualizarSala(codigo, { bloqueada: true }), restanteMs);
  }
}
function detenerTimerBloqueo() {
  if (timerBloqueo) { clearTimeout(timerBloqueo); timerBloqueo = null; }
}

/* ============================= Resumen final ============================= */
function mostrarResumen() {
  $("vista-actividad").classList.add("oculto");
  $("vista-crear").classList.add("oculto");
  $("vista-final").classList.remove("oculto");

  $("fin-participantes").textContent = participantes.length;
  $("fin-respuestas").textContent = respuestas.length;

  // Tiempo promedio de respuesta.
  const tiempos = respuestas.map((r) => r.tiempoMs).filter((t) => t > 0);
  const promedio = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
  $("fin-tiempo").textContent = promedio ? formatearTiempo(promedio) : "—";

  // Distribución por afirmación (una tarjeta con barras por cada una).
  const cont = $("fin-distribucion");
  cont.innerHTML = "";
  sala.afirmaciones.forEach((texto, idx) => {
    const bloque = document.createElement("div");
    bloque.className = "tarjeta";
    bloque.style.marginBottom = "14px";
    bloque.innerHTML = `<p class="afirmacion" style="font-size:1.1rem; margin-bottom:16px;">${escaparHTML(texto)}</p><div class="barras-fin"></div>`;
    cont.appendChild(bloque);
    renderBarras(bloque.querySelector(".barras-fin"), respuestas.filter((r) => r.indice === idx));
  });
}
