/* =============================================================================
 *  docente.js  —  Lógica del panel de la docente
 * ========================================================================== */

import { PREGUNTAS, AJUSTES_DEFECTO } from "./config.js";
import {
  crearSala, obtenerSala, actualizarSala,
  escucharSala, escucharParticipantes, escucharRespuestas
} from "./firebase.js";
import {
  inicializarTema, alternarPantallaCompleta, avisar,
  generarCodigoSala, mezclarArreglo, dibujarQR, copiarAlPortapapeles,
  formatearTiempo, armarFilas, exportarCSV, exportarExcel, exportarJSON, escaparHTML
} from "./utils.js";
import { renderBarras, renderMultiple, renderDesarrollo, renderJustificaciones } from "./vistas.js";

let codigo = null;
let sala = null;
let participantes = [];
let respuestas = [];
let timerBloqueo = null;

const $ = (id) => document.getElementById(id);

/* ---------------------------- Arranque ----------------------------------- */
inicializarTema($("btn-tema"));
$("btn-pantalla").addEventListener("click", alternarPantallaCompleta);
$("cant-afirmaciones").textContent = PREGUNTAS.length;

const guardado = localStorage.getItem("salaDocente");
if (guardado) reanudar(guardado);

$("btn-crear").addEventListener("click", crear);

/* ============================ Crear la sala ============================== */
async function crear() {
  codigo = generarCodigoSala();

  const mezclar = $("cfg-mezclar").checked;
  const preguntas = mezclar ? mezclarArreglo(PREGUNTAS) : [...PREGUNTAS];

  const config = {
    preguntas,
    mezclarPreguntas: mezclar,
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

async function reanudar(cod) {
  const datos = await obtenerSala(cod);
  if (!datos || datos.estado === "final") { localStorage.removeItem("salaDocente"); return; }
  codigo = cod;
  abrirActividad();
}

function abrirActividad() {
  $("vista-crear").classList.add("oculto");
  $("vista-actividad").classList.remove("oculto");

  const url = new URL(`estudiante.html?sala=${codigo}`, location.href).href;
  $("codigo-sala").textContent = codigo;
  $("link-estudiante").href = url;
  dibujarQR($("qr"), url, 150);
  $("btn-copiar").addEventListener("click", async () => {
    await copiarAlPortapapeles(url);
    avisar("Enlace copiado.");
  });

  conectarControles();

  escucharSala(codigo, (d) => { sala = d; render(); });
  escucharParticipantes(codigo, (l) => { participantes = l; render(); });
  escucharRespuestas(codigo, (l) => { respuestas = l; render(); });
}

/* ======================= Controles del panel ============================ */
function conectarControles() {
  $("ctrl-iniciar").onclick = () => irAPregunta(0);
  $("ctrl-bloquear").onclick = () => actualizarSala(codigo, { bloqueada: !sala.bloqueada });
  $("ctrl-resultados").onclick = () => {
    const nuevo = sala.estado === "resultados" ? "pregunta" : "resultados";
    actualizarSala(codigo, { estado: nuevo });
  };
  $("ctrl-justificaciones").onclick = () =>
    actualizarSala(codigo, { mostrarJustificaciones: !sala.mostrarJustificaciones });
  $("ctrl-editar").onclick = () =>
    actualizarSala(codigo, { permitirEdicion: !sala.permitirEdicion });
  $("ctrl-siguiente").onclick = () => {
    const siguiente = sala.indiceActual + 1;
    if (siguiente < sala.preguntas.length) irAPregunta(siguiente);
    else finalizar();
  };
  $("ctrl-finalizar").onclick = finalizar;

  const exportar = (fn, ext) => () => fn(armarFilas(respuestas, sala?.preguntas), `alfabetizacion-${codigo}.${ext}`);
  $("exp-csv").onclick   = exportar(exportarCSV, "csv");
  $("exp-excel").onclick = exportar(exportarExcel, "xlsx");
  $("exp-json").onclick  = exportar(exportarJSON, "json");
  $("fin-csv").onclick   = exportar(exportarCSV, "csv");
  $("fin-excel").onclick = exportar(exportarExcel, "xlsx");
  $("fin-json").onclick  = exportar(exportarJSON, "json");
}

function irAPregunta(indice) {
  actualizarSala(codigo, {
    estado: "pregunta",
    indiceActual: indice,
    bloqueada: false,
    inicioPreguntaMs: Date.now()
  });
}

function finalizar() {
  actualizarSala(codigo, { estado: "final" });
}

/* ============================ Render ==================================== */
function render() {
  if (!sala) return;

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

function renderParticipantes() {
  const cont = $("lista-participantes");
  $("cont-participantes").textContent = `${participantes.length} en la sala`;
  $("sin-participantes").classList.toggle("oculto", participantes.length > 0);

  const respondieron = new Set(
    respuestas.filter((r) => r.indice === sala.indiceActual).map((r) => r.idParticipante)
  );
  cont.innerHTML = participantes.map((p) =>
    `<span class="ficha ${respondieron.has(p.id) ? "respondio" : ""}">${escaparHTML(p.nombre)}</span>`
  ).join("");
}

function renderEstadoActual() {
  const total = sala.preguntas?.length || 0;
  const i = sala.indiceActual;
  const enSala = sala.estado === "sala";
  const pregunta = sala.preguntas?.[i];

  if (enSala) {
    $("doc-paso").textContent = "Sala de espera";
    $("doc-relleno").style.width = "0%";
    $("doc-afirmacion").textContent = "Cuando estén todas, tocá «Iniciar actividad».";
    $("doc-tipo-badge").textContent = "";
  } else {
    const etiqueta = sala.estado === "resultados" ? " · resultados" : "";
    $("doc-paso").textContent = `Pregunta ${i + 1} de ${total}${etiqueta}`;
    $("doc-relleno").style.width = `${((i + 1) / total) * 100}%`;
    $("doc-afirmacion").textContent = pregunta?.texto || "";
    // Badge con el tipo de pregunta
    const tipos = { debate: "Debate", siNo: "Sí / No", desarrollo: "Desarrollo", multiple: "Múltiple opción" };
    $("doc-tipo-badge").textContent = tipos[pregunta?.tipo] || "";
  }

  const contador = $("doc-contador");
  contador.style.visibility = enSala ? "hidden" : "visible";
  const respondieron = new Set(
    respuestas.filter((r) => r.indice === i).map((r) => r.idParticipante)
  ).size;
  $("doc-respondieron").textContent = respondieron;
  $("doc-total").textContent = participantes.length;

  // Resultados en el panel docente
  const zona = $("doc-resultados");
  if (sala.estado === "resultados" && pregunta) {
    zona.classList.remove("oculto");
    const deEsta = respuestas.filter((r) => r.indice === i);

    switch (pregunta.tipo) {
      case "debate":
        renderBarras($("doc-barras"), deEsta, "debate");
        $("doc-barras").classList.remove("oculto");
        if (sala.mostrarJustificaciones) {
          renderJustificaciones($("doc-justificaciones"), deEsta, sala.mostrarNombres);
          $("doc-justificaciones").classList.remove("oculto");
        } else {
          $("doc-justificaciones").innerHTML = `<p class="subtitulo" style="font-size:.9rem;">Justificaciones ocultas.</p>`;
        }
        break;
      case "siNo":
        renderBarras($("doc-barras"), deEsta, "siNo");
        $("doc-barras").classList.remove("oculto");
        if (sala.mostrarJustificaciones) {
          renderJustificaciones($("doc-justificaciones"), deEsta, sala.mostrarNombres);
          $("doc-justificaciones").classList.remove("oculto");
        } else {
          $("doc-justificaciones").innerHTML = `<p class="subtitulo" style="font-size:.9rem;">Justificaciones ocultas.</p>`;
        }
        break;
      case "multiple":
        renderMultiple($("doc-barras"), deEsta, pregunta.opciones || []);
        $("doc-barras").classList.remove("oculto");
        $("doc-justificaciones").classList.add("oculto");
        break;
      case "desarrollo":
        $("doc-barras").classList.add("oculto");
        $("doc-justificaciones").classList.remove("oculto");
        $("doc-justificaciones").previousElementSibling?.querySelector("h2") &&
          ($("doc-justificaciones").previousElementSibling.querySelector("h2").textContent = "Respuestas");
        renderDesarrollo($("doc-justificaciones"), deEsta, sala.mostrarNombres);
        break;
    }
  } else {
    zona.classList.add("oculto");
  }
}

function renderControles() {
  const enSala = sala.estado === "sala";
  const enResultados = sala.estado === "resultados";
  const esUltima = sala.indiceActual >= (sala.preguntas?.length || 1) - 1;

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

  $("ctrl-siguiente").textContent = esUltima ? "Finalizar actividad" : "Siguiente pregunta";

  const hay = respuestas.length > 0;
  ["exp-csv", "exp-excel", "exp-json"].forEach((id) => { $(id).disabled = !hay; });
}

function gestionarTimerBloqueo() {
  detenerTimerBloqueo();
  const seg = sala.segundosTemporizador;
  if (sala.estado !== "pregunta" || sala.bloqueada || !seg || !sala.inicioPreguntaMs) return;
  const restanteMs = seg * 1000 - (Date.now() - sala.inicioPreguntaMs);
  if (restanteMs <= 0) actualizarSala(codigo, { bloqueada: true });
  else timerBloqueo = setTimeout(() => actualizarSala(codigo, { bloqueada: true }), restanteMs);
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

  const tiempos = respuestas.map((r) => r.tiempoMs).filter((t) => t > 0);
  const promedio = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
  $("fin-tiempo").textContent = promedio ? formatearTiempo(promedio) : "—";

  const cont = $("fin-distribucion");
  cont.innerHTML = "";

  (sala.preguntas || []).forEach((pregunta, idx) => {
    const bloque = document.createElement("div");
    bloque.className = "tarjeta";
    bloque.style.marginBottom = "14px";

    const tipos = { debate: "Debate", siNo: "Sí / No", desarrollo: "Desarrollo libre", multiple: "Múltiple opción" };
    bloque.innerHTML = `
      <p style="font-size:.8rem; color:var(--muted); margin-bottom:4px;">${tipos[pregunta.tipo] || ""}</p>
      <p class="afirmacion" style="font-size:1.05rem; margin-bottom:14px;">${escaparHTML(pregunta.texto)}</p>
      <div class="area-resumen-fin"></div>`;
    cont.appendChild(bloque);

    const area = bloque.querySelector(".area-resumen-fin");
    const deEsta = respuestas.filter((r) => r.indice === idx);

    switch (pregunta.tipo) {
      case "debate":  renderBarras(area, deEsta, "debate"); break;
      case "siNo":    renderBarras(area, deEsta, "siNo"); break;
      case "multiple": renderMultiple(area, deEsta, pregunta.opciones || []); break;
      case "desarrollo":
        renderDesarrollo(area, deEsta, false);
        break;
    }
  });
}
