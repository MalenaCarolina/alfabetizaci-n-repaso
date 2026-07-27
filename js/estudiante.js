/* =============================================================================
 *  estudiante.js  —  Lógica de la vista de las estudiantes
 * -----------------------------------------------------------------------------
 *  Se encarga de: ingresar a la sala, mostrar la afirmación activa, registrar
 *  la respuesta con su justificación, y cambiar de pantalla según lo que la
 *  docente vaya habilitando (todo en tiempo real).
 * ========================================================================== */

import { OPCIONES, MAX_CARACTERES_JUSTIFICACION } from "./config.js";
import {
  obtenerSala, unirseComoParticipante, escucharSala,
  escucharParticipantes, escucharRespuestas, guardarRespuesta
} from "./firebase.js";
import {
  inicializarTema, alternarPantallaCompleta, avisar,
  generarId, formatearTiempo
} from "./utils.js";
import { renderBarras, renderJustificaciones } from "./vistas.js";

/* ------------------------- Estado local en memoria ------------------------ */
const codigo = (new URLSearchParams(location.search).get("sala") || "").toUpperCase();
let idParticipante = null;
let nombre = "";
let sala = null;                 // último estado de la sala
let participantes = [];          // lista de participantes
let respuestas = [];             // todas las respuestas de la sala
let opcionElegida = null;        // opción seleccionada en la pregunta actual
let indiceRenderizado = -99;     // para detectar cambio de afirmación
let cuandoAparecio = 0;          // marca de tiempo para medir cuánto tarda
let editando = false;            // true si la estudiante pidió modificar
let intervaloTimer = null;       // temporizador visual

/* --------------------------- Atajos al DOM -------------------------------- */
const $ = (id) => document.getElementById(id);
const vistas = {
  nombre:      $("vista-nombre"),
  sala:        $("vista-sala"),
  pregunta:    $("vista-pregunta"),
  respondido:  $("vista-respondido"),
  cerrada:     $("vista-cerrada"),
  resultados:  $("vista-resultados"),
  final:       $("vista-final")
};

/* Muestra una sola de las “vistas grandes” y oculta las demás. */
function mostrarVista(clave) {
  ["nombre", "sala", "pregunta", "resultados", "final"].forEach((k) => {
    vistas[k].classList.toggle("oculto", k !== clave);
  });
}

/* ============================ Arranque ==================================== */
inicializarTema($("btn-tema"));
$("btn-pantalla").addEventListener("click", alternarPantallaCompleta);

// Aplicamos el máximo de caracteres definido en config.js (un solo lugar a editar).
$("justificacion").maxLength = MAX_CARACTERES_JUSTIFICACION;
$("max-caracteres").textContent = MAX_CARACTERES_JUSTIFICACION;

if (!codigo) {
  // Sin código no hay nada que hacer: volvemos al inicio.
  location.href = "index.html";
} else {
  iniciar();
}

async function iniciar() {
  // 1) Verificamos que la sala exista y leemos su configuración.
  const datos = await obtenerSala(codigo);
  if (!datos) {
    vistas.nombre.classList.remove("oculto");
    const err = $("error-sala");
    err.textContent = "No encontramos esa sala. Revisá el código con la docente.";
    err.classList.remove("oculto");
    $("btn-unirse").disabled = true;
    return;
  }

  // Ajustamos el texto según si se permite seudónimo.
  if (datos.permitirSeudonimo) {
    $("sub-nombre").textContent = "Escribí tu nombre o un seudónimo para entrar.";
    $("etiqueta-nombre").textContent = "Tu nombre o seudónimo";
  }

  // 2) ¿Ya estábamos en esta sala? (recuperamos identidad tras recargar)
  const guardado = JSON.parse(localStorage.getItem("part_" + codigo) || "null");
  if (guardado?.id && guardado?.nombre) {
    idParticipante = guardado.id;
    nombre = guardado.nombre;
    conectar();
  } else {
    prepararIngreso();
  }
}

/* --------------------------- Ingreso con nombre --------------------------- */
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

/* --------------- Conexión en tiempo real (sala + datos) ------------------ */
function conectar() {
  escucharSala(codigo, (datos) => { sala = datos; render(); });
  escucharParticipantes(codigo, (lista) => { participantes = lista; render(); });
  escucharRespuestas(codigo, (lista) => { respuestas = lista; render(); });
}

/* ============================ Render principal ============================ */
/* Se llama cada vez que cambia algo. Decide qué pantalla mostrar. */
function render() {
  if (!sala) return;

  const progreso = $("progreso");
  const total = sala.afirmaciones?.length || 0;
  const i = sala.indiceActual;

  // Barra de progreso (solo durante la actividad).
  const enActividad = sala.estado === "pregunta" || sala.estado === "resultados";
  progreso.classList.toggle("oculto", !enActividad);
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

/* --------- Respuestas de la afirmación activa y la mía (si existe) -------- */
function respuestasActuales() {
  return respuestas.filter((r) => r.indice === sala.indiceActual);
}
function miRespuestaActual() {
  return respuestas.find((r) => r.indice === sala.indiceActual && r.idParticipante === idParticipante);
}

/* ============================ Vista: PREGUNTA ============================ */
function renderPregunta() {
  mostrarVista("pregunta");

  const i = sala.indiceActual;
  const afirmacion = sala.afirmaciones[i] || "";
  $("afirmacion").textContent = afirmacion;

  const mia = miRespuestaActual();
  const puedeEditar = sala.permitirEdicion;

  // Caso 1: ya respondí y (no puedo editar, o no estoy editando) → esperar.
  if (mia && !(editando && puedeEditar)) {
    mostrarEstadoRespondido(puedeEditar);
    return;
  }

  // Caso 2: la pregunta está cerrada y no respondí → aviso de cierre.
  if (sala.bloqueada && !mia) {
    vistas.pregunta.querySelectorAll(".opciones, .zona-justificacion").forEach((el) => el.classList.add("oculto"));
    $("vista-respondido").classList.add("oculto");
    $("vista-cerrada").classList.remove("oculto");
    detenerTimer();
    return;
  }

  // Caso 3: puedo responder → mostramos el formulario.
  $("vista-cerrada").classList.add("oculto");
  $("vista-respondido").classList.add("oculto");
  $("opciones").classList.remove("oculto");

  // Si cambió la afirmación (o entré a editar), reiniciamos el formulario.
  const clave = editando ? `${i}-edit` : i;
  if (indiceRenderizado !== clave) {
    indiceRenderizado = clave;
    construirFormulario(mia);
    cuandoAparecio = Date.now();          // arrancamos a medir el tiempo
    iniciarTimer();
  }
}

/* Construye las tres opciones y el cuadro de justificación. */
function construirFormulario(respuestaPrevia) {
  const cont = $("opciones");
  cont.classList.remove("bloqueadas");
  cont.innerHTML = OPCIONES.map((op) => `
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

  // Estado inicial: nada elegido, justificación vacía.
  opcionElegida = respuestaPrevia?.opcion || null;
  texto.value = respuestaPrevia?.justificacion || "";
  contador.textContent = texto.value.length;

  const revisarEnvio = () => {
    enviar.disabled = !(opcionElegida && texto.value.trim().length > 0);
  };

  // Selección de opción.
  cont.querySelectorAll(".opcion").forEach((btn) => {
    btn.addEventListener("click", () => {
      opcionElegida = btn.dataset.clave;
      cont.querySelectorAll(".opcion").forEach((b) => {
        const activa = b === btn;
        b.classList.toggle("activa", activa);
        b.setAttribute("aria-checked", activa ? "true" : "false");
      });
      zona.classList.add("visible");      // despliega la justificación
      texto.focus();
      revisarEnvio();
    });
  });

  // Si venía con respuesta previa (edición), reflejamos la selección.
  if (opcionElegida) {
    const btn = cont.querySelector(`.opcion[data-clave="${opcionElegida}"]`);
    if (btn) { btn.classList.add("activa"); btn.setAttribute("aria-checked", "true"); }
    zona.classList.add("visible");
  } else {
    zona.classList.remove("visible");
  }

  // Contador de caracteres.
  texto.addEventListener("input", () => {
    contador.textContent = texto.value.length;
    contador.parentElement.classList.toggle("limite", texto.value.length >= MAX_CARACTERES_JUSTIFICACION);
    revisarEnvio();
  });

  enviar.disabled = true;
  revisarEnvio();
  enviar.onclick = enviarRespuesta;
}

/* Envía la respuesta a Firestore. */
async function enviarRespuesta() {
  const justificacion = $("justificacion").value.trim();
  if (!opcionElegida) { avisar("Elegí una opción."); return; }
  if (!justificacion) { avisar("La justificación no puede quedar vacía."); return; }

  const boton = $("btn-enviar");
  boton.disabled = true;
  boton.textContent = "Enviando…";

  try {
    await guardarRespuesta(codigo, idParticipante, sala.indiceActual, {
      nombre,
      afirmacion: sala.afirmaciones[sala.indiceActual],
      opcion: opcionElegida,
      justificacion,
      tiempoMs: Date.now() - cuandoAparecio
    });
    editando = false;
    indiceRenderizado = -99;            // fuerza recomputar en el próximo render
    detenerTimer();
    // El listener de respuestas volverá a llamar a render() y mostrará "registrada".
  } catch (e) {
    avisar("No se pudo enviar. Reintentá.");
    console.error(e);
    boton.disabled = false;
    boton.textContent = "Enviar respuesta";
  }
}

/* Pantalla de “respuesta registrada / esperando”. */
function mostrarEstadoRespondido(puedeEditar) {
  $("opciones").classList.add("oculto");
  $("zona-justificacion").classList.remove("visible");
  $("vista-cerrada").classList.add("oculto");
  $("vista-respondido").classList.remove("oculto");
  detenerTimer();

  // Mensaje según cuánta gente respondió.
  const respondieron = new Set(respuestasActuales().map((r) => r.idParticipante)).size;
  const total = participantes.length;
  if (total > 0 && respondieron >= total) {
    $("txt-respondido").textContent = "Todos respondieron. Esperando que la docente muestre los resultados.";
  } else {
    $("txt-respondido").textContent =
      `Esperando que finalicen los demás participantes… (${respondieron} de ${total})`;
  }

  // Botón para modificar, solo si la docente lo habilitó.
  const btnEditar = $("btn-editar");
  btnEditar.classList.toggle("oculto", !puedeEditar);
  btnEditar.onclick = () => {
    editando = true;
    indiceRenderizado = -99;
    render();
  };
}

/* ============================ Vista: RESULTADOS ========================== */
function renderResultados() {
  mostrarVista("resultados");
  detenerTimer();

  const i = sala.indiceActual;
  $("afirmacion-res").textContent = sala.afirmaciones[i] || "";

  const deEsta = respuestasActuales();
  renderBarras($("barras"), deEsta);

  // Las justificaciones se pueden ocultar desde el panel docente.
  const bloque = $("bloque-justificaciones");
  if (sala.mostrarJustificaciones) {
    bloque.classList.remove("oculto");
    renderJustificaciones($("justificaciones"), deEsta, sala.mostrarNombres);
  } else {
    bloque.classList.add("oculto");
  }
}

/* ============================== Temporizador ============================= */
function iniciarTimer() {
  detenerTimer();
  const segundos = sala.segundosTemporizador;
  if (!segundos || segundos <= 0 || !sala.inicioPreguntaMs) {
    $("txt-cierre").textContent = "";
    return;
  }
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
