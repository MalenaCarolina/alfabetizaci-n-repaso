/* =============================================================================
 *  estudiante.js  —  Lógica de la vista de las estudiantes
 * ========================================================================== */

import { OPCIONES_DEBATE, OPCIONES_SI_NO, MAX_CARACTERES } from "./config.js";
import {
  obtenerSala, unirseComoParticipante, escucharSala,
  escucharParticipantes, escucharRespuestas, guardarRespuesta
} from "./firebase.js";
import {
  inicializarTema, alternarPantallaCompleta, avisar,
  generarId, formatearTiempo
} from "./utils.js";
import { renderBarras, renderMultiple, renderDesarrollo, renderJustificaciones } from "./vistas.js";

/* ------------------------- Estado local ----------------------------------- */
const codigo = (new URLSearchParams(location.search).get("sala") || "").toUpperCase();
let idParticipante = null;
let nombre = "";
let sala = null;
let participantes = [];
let respuestas = [];
let opcionElegida = null;       // para debate / siNo
let opcionesElegidas = new Set(); // para múltiple
let indiceRenderizado = -99;
let cuandoAparecio = 0;
let editando = false;
let intervaloTimer = null;

const $ = (id) => document.getElementById(id);

const vistas = {
  nombre:     $("vista-nombre"),
  sala:       $("vista-sala"),
  pregunta:   $("vista-pregunta"),
  resultados: $("vista-resultados"),
  final:      $("vista-final")
};

function mostrarVista(clave) {
  Object.keys(vistas).forEach((k) => {
    vistas[k].classList.toggle("oculto", k !== clave);
  });
}

/* ============================ Arranque ==================================== */
inicializarTema($("btn-tema"));
$("btn-pantalla").addEventListener("click", alternarPantallaCompleta);
$("justificacion").maxLength = MAX_CARACTERES;
$("max-caracteres").textContent = MAX_CARACTERES;
$("txt-desarrollo").maxLength = MAX_CARACTERES;
$("max-caracteres-dev").textContent = MAX_CARACTERES;

if (!codigo) {
  location.href = "index.html";
} else {
  iniciar();
}

async function iniciar() {
  const datos = await obtenerSala(codigo);
  if (!datos) {
    vistas.nombre.classList.remove("oculto");
    const err = $("error-sala");
    err.textContent = "No encontramos esa sala. Revisá el código con la docente.";
    err.classList.remove("oculto");
    $("btn-unirse").disabled = true;
    return;
  }

  if (datos.permitirSeudonimo) {
    $("sub-nombre").textContent = "Escribí tu nombre o un seudónimo para entrar.";
    $("etiqueta-nombre").textContent = "Tu nombre o seudónimo";
  }

  const guardado = JSON.parse(localStorage.getItem("part_" + codigo) || "null");
  if (guardado?.id && guardado?.nombre) {
    idParticipante = guardado.id;
    nombre = guardado.nombre;
    conectar();
  } else {
    prepararIngreso();
  }
}

/* --------------------------- Ingreso -------------------------------------- */
function prepararIngreso() {
  mostrarVista("nombre");
  const input = $("nombre");
  const unirse = async () => {
    const valor = input.value.trim();
    if (valor.length < 2) { avisar("Escribí tu nombre para entrar."); return; }
    idParticipante = generarId();
    nombre = valor;
    localStorage.setItem("part_" + codigo, JSON.stringify({ id: idParticipante, nombre }));
    try {
      await unirseComoParticipante(codigo, idParticipante, nombre);
      conectar();
    } catch (e) {
      avisar("No pudimos conectarte. Revisá tu conexión.");
      console.error(e);
    }
  };
  $("btn-unirse").addEventListener("click", unirse);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") unirse(); });
  input.focus();
}

/* ------------------------- Conexión --------------------------------------- */
function conectar() {
  escucharSala(codigo, (d) => { sala = d; render(); });
  escucharParticipantes(codigo, (l) => { participantes = l; render(); });
  escucharRespuestas(codigo, (l) => { respuestas = l; render(); });
}

/* ============================ Render ====================================== */
function render() {
  if (!sala) return;

  const total = sala.preguntas?.length || 0;
  const i = sala.indiceActual;
  const enActividad = sala.estado === "pregunta" || sala.estado === "resultados";

  $("progreso").classList.toggle("oculto", !enActividad);
  if (enActividad && i >= 0) {
    $("txt-paso").textContent = `Pregunta ${i + 1} de ${total}`;
    $("relleno-progreso").style.width = `${((i + 1) / total) * 100}%`;
  }

  switch (sala.estado) {
    case "sala":       mostrarVista("sala"); break;
    case "pregunta":   renderPregunta(); break;
    case "resultados": renderResultados(); break;
    case "final":      mostrarVista("final"); detenerTimer(); break;
  }
}

function preguntaActual() {
  return sala.preguntas?.[sala.indiceActual] || null;
}
function respuestasActuales() {
  return respuestas.filter((r) => r.indice === sala.indiceActual);
}
function miRespuestaActual() {
  return respuestas.find((r) => r.indice === sala.indiceActual && r.idParticipante === idParticipante);
}

/* ============================ Vista: PREGUNTA ============================ */
function renderPregunta() {
  mostrarVista("pregunta");

  const pregunta = preguntaActual();
  if (!pregunta) return;

  $("afirmacion").textContent = pregunta.texto;
  const mia = miRespuestaActual();
  const puedeEditar = sala.permitirEdicion;

  // Ya respondí → mostrar estado de espera
  if (mia && !(editando && puedeEditar)) {
    mostrarEstadoRespondido(puedeEditar);
    return;
  }

  // Cerrada sin responder
  if (sala.bloqueada && !mia) {
    ocultarFormularios();
    $("vista-respondido").classList.add("oculto");
    $("vista-cerrada").classList.remove("oculto");
    detenerTimer();
    return;
  }

  // Formulario activo
  $("vista-cerrada").classList.add("oculto");
  $("vista-respondido").classList.add("oculto");

  const clave = editando ? `${sala.indiceActual}-edit` : sala.indiceActual;
  if (indiceRenderizado !== clave) {
    indiceRenderizado = clave;
    cuandoAparecio = Date.now();
    construirFormulario(pregunta, mia);
    iniciarTimer();
  }
}

function ocultarFormularios() {
  $("bloque-debate").classList.add("oculto");
  $("bloque-desarrollo").classList.add("oculto");
  $("bloque-multiple").classList.add("oculto");
}

/* Construye el formulario según el tipo de pregunta */
function construirFormulario(pregunta, respuestaPrevia) {
  ocultarFormularios();

  switch (pregunta.tipo) {
    case "debate":    construirDebate(OPCIONES_DEBATE, respuestaPrevia); break;
    case "siNo":      construirDebate(OPCIONES_SI_NO, respuestaPrevia); break;
    case "desarrollo": construirDesarrollo(respuestaPrevia); break;
    case "multiple":  construirMultiple(pregunta.opciones || [], respuestaPrevia); break;
  }
}

/* --- Debate / SiNo -------------------------------------------------------- */
function construirDebate(opciones, respuestaPrevia) {
  const bloque = $("bloque-debate");
  bloque.classList.remove("oculto");

  const cont = $("opciones");
  cont.classList.remove("bloqueadas");
  cont.innerHTML = opciones.map((op) => `
    <button type="button" class="opcion" role="radio" aria-checked="false" data-clave="${op.clave}">
      <span class="emoji" aria-hidden="true">${op.emoji}</span>
      <span>${op.texto}</span>
      <span class="marca-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
      </span>
    </button>`).join("");

  const zona = $("zona-justificacion");
  const texto = $("justificacion");
  const contador = $("contador");
  const enviar = $("btn-enviar");

  opcionElegida = respuestaPrevia?.opcion || null;
  texto.value = respuestaPrevia?.justificacion || "";
  contador.textContent = texto.value.length;

  const revisarEnvio = () => {
    enviar.disabled = !(opcionElegida && texto.value.trim().length > 0);
  };

  cont.querySelectorAll(".opcion").forEach((btn) => {
    btn.addEventListener("click", () => {
      opcionElegida = btn.dataset.clave;
      cont.querySelectorAll(".opcion").forEach((b) => {
        const activa = b === btn;
        b.classList.toggle("activa", activa);
        b.setAttribute("aria-checked", activa ? "true" : "false");
      });
      zona.classList.add("visible");
      texto.focus();
      revisarEnvio();
    });
  });

  if (opcionElegida) {
    const btn = cont.querySelector(`.opcion[data-clave="${opcionElegida}"]`);
    if (btn) { btn.classList.add("activa"); btn.setAttribute("aria-checked", "true"); }
    zona.classList.add("visible");
  } else {
    zona.classList.remove("visible");
  }

  texto.addEventListener("input", () => {
    contador.textContent = texto.value.length;
    contador.parentElement.classList.toggle("limite", texto.value.length >= MAX_CARACTERES);
    revisarEnvio();
  });

  enviar.disabled = true;
  revisarEnvio();
  enviar.onclick = () => enviarDebate();
}

/* --- Desarrollo libre ----------------------------------------------------- */
function construirDesarrollo(respuestaPrevia) {
  const bloque = $("bloque-desarrollo");
  bloque.classList.remove("oculto");

  const texto = $("txt-desarrollo");
  const contador = $("contador-dev");
  const enviar = $("btn-enviar-dev");

  texto.value = respuestaPrevia?.respuesta || "";
  contador.textContent = texto.value.length;

  const revisarEnvio = () => {
    enviar.disabled = texto.value.trim().length < 3;
  };

  texto.addEventListener("input", () => {
    contador.textContent = texto.value.length;
    texto.parentElement.classList.toggle("limite", texto.value.length >= MAX_CARACTERES);
    revisarEnvio();
  });

  revisarEnvio();
  enviar.onclick = () => enviarDesarrollo();
  texto.focus();
}

/* --- Selección múltiple --------------------------------------------------- */
function construirMultiple(opciones, respuestaPrevia) {
  const bloque = $("bloque-multiple");
  bloque.classList.remove("oculto");

  const cont = $("opciones-multiple");
  opcionesElegidas = new Set(respuestaPrevia?.opciones || []);

  cont.innerHTML = opciones.map((texto, idx) => `
    <label class="opcion-multiple ${opcionesElegidas.has(texto) ? "activa" : ""}">
      <input type="checkbox" value="${escaparParaAttr(texto)}"
             ${opcionesElegidas.has(texto) ? "checked" : ""} />
      <span class="marca-check-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
      </span>
      <span>${escaparHTML(texto)}</span>
    </label>`).join("");

  const enviar = $("btn-enviar-mult");

  const revisarEnvio = () => {
    enviar.disabled = opcionesElegidas.size === 0;
  };

  cont.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const val = cb.value;
      if (cb.checked) opcionesElegidas.add(val);
      else opcionesElegidas.delete(val);
      cb.closest(".opcion-multiple").classList.toggle("activa", cb.checked);
      revisarEnvio();
    });
  });

  revisarEnvio();
  enviar.onclick = () => enviarMultiple();
}

function escaparHTML(texto = "") {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
function escaparParaAttr(texto = "") {
  return texto.replace(/"/g, "&quot;");
}

/* ============================ Envíos ====================================== */
async function enviarDebate() {
  const justificacion = $("justificacion").value.trim();
  if (!opcionElegida) { avisar("Elegí una opción."); return; }
  if (!justificacion) { avisar("Escribí una justificación antes de enviar."); return; }
  await enviar({ opcion: opcionElegida, justificacion });
}

async function enviarDesarrollo() {
  const respuesta = $("txt-desarrollo").value.trim();
  if (respuesta.length < 3) { avisar("Escribí tu respuesta antes de enviar."); return; }
  await enviar({ respuesta });
}

async function enviarMultiple() {
  if (opcionesElegidas.size === 0) { avisar("Marcá al menos una opción."); return; }
  await enviar({ opciones: [...opcionesElegidas] });
}

async function enviar(datos) {
  // Deshabilitamos todos los botones de envío
  ["btn-enviar", "btn-enviar-dev", "btn-enviar-mult"].forEach((id) => {
    const btn = $(id);
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
  });

  const pregunta = preguntaActual();

  try {
    await guardarRespuesta(codigo, idParticipante, sala.indiceActual, {
      nombre,
      textoPregunta: pregunta.texto,
      tipoPregunta: pregunta.tipo,
      ...datos,
      tiempoMs: Date.now() - cuandoAparecio
    });
    editando = false;
    indiceRenderizado = -99;
    detenerTimer();
  } catch (e) {
    avisar("No se pudo enviar. Reintentá.");
    console.error(e);
    ["btn-enviar", "btn-enviar-dev", "btn-enviar-mult"].forEach((id) => {
      const btn = $(id);
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.id === "btn-enviar" ? "Enviar respuesta" :
                          btn.id === "btn-enviar-dev" ? "Enviar respuesta" : "Enviar selección";
      }
    });
  }
}

/* Pantalla de "respuesta registrada" */
function mostrarEstadoRespondido(puedeEditar) {
  ocultarFormularios();
  $("zona-justificacion").classList.remove("visible");
  $("vista-cerrada").classList.add("oculto");
  $("vista-respondido").classList.remove("oculto");
  detenerTimer();

  const respondieron = new Set(respuestasActuales().map((r) => r.idParticipante)).size;
  const total = participantes.length;
  $("txt-respondido").textContent =
    total > 0 && respondieron >= total
      ? "Todos respondieron. Esperando que la docente muestre los resultados."
      : `Esperando que finalicen los demás participantes… (${respondieron} de ${total})`;

  const btnEditar = $("btn-editar");
  btnEditar.classList.toggle("oculto", !puedeEditar);
  btnEditar.onclick = () => { editando = true; indiceRenderizado = -99; render(); };
}

/* ============================ Vista: RESULTADOS ========================== */
function renderResultados() {
  mostrarVista("resultados");
  detenerTimer();

  const i = sala.indiceActual;
  const pregunta = preguntaActual();
  $("afirmacion-res").textContent = pregunta?.texto || "";

  const deEsta = respuestasActuales();
  const contenedor = $("barras");
  const bloqueJustif = $("bloque-justificaciones");

  switch (pregunta?.tipo) {
    case "debate":
      contenedor.classList.remove("oculto");
      renderBarras(contenedor, deEsta, "debate");
      if (sala.mostrarJustificaciones) {
        bloqueJustif.classList.remove("oculto");
        renderJustificaciones($("justificaciones"), deEsta, sala.mostrarNombres);
      } else {
        bloqueJustif.classList.add("oculto");
      }
      break;

    case "siNo":
      contenedor.classList.remove("oculto");
      renderBarras(contenedor, deEsta, "siNo");
      if (sala.mostrarJustificaciones) {
        bloqueJustif.classList.remove("oculto");
        renderJustificaciones($("justificaciones"), deEsta, sala.mostrarNombres);
      } else {
        bloqueJustif.classList.add("oculto");
      }
      break;

    case "multiple":
      contenedor.classList.remove("oculto");
      renderMultiple(contenedor, deEsta, pregunta.opciones || []);
      bloqueJustif.classList.add("oculto");
      break;

    case "desarrollo":
      contenedor.classList.add("oculto");
      bloqueJustif.classList.remove("oculto");
      $("bloque-justificaciones").querySelector("h2").textContent = "Respuestas";
      renderDesarrollo($("justificaciones"), deEsta, sala.mostrarNombres);
      break;
  }
}

/* ============================== Timer ==================================== */
function iniciarTimer() {
  detenerTimer();
  const segundos = sala.segundosTemporizador;
  if (!segundos || !sala.inicioPreguntaMs) { $("txt-cierre").textContent = ""; return; }
  const actualizar = () => {
    const restante = Math.max(0, segundos - Math.floor((Date.now() - sala.inicioPreguntaMs) / 1000));
    $("txt-cierre").textContent = restante > 0 ? `⏱ ${formatearTiempo(restante * 1000)}` : "⏱ tiempo cumplido";
    if (restante <= 0) detenerTimer();
  };
  actualizar();
  intervaloTimer = setInterval(actualizar, 1000);
}
function detenerTimer() {
  if (intervaloTimer) { clearInterval(intervaloTimer); intervaloTimer = null; }
}
