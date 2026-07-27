/* =============================================================================
 *  firebase.js  —  Capa de datos (todo lo que habla con Firestore vive acá)
 * -----------------------------------------------------------------------------
 *  El resto de la app (docente.js, estudiante.js) nunca toca Firestore
 *  directamente: le pide las cosas a estas funciones. Así, si algún día
 *  cambiás de base de datos, solo tenés que reescribir este archivo.
 *
 *  Modelo de datos en Firestore:
 *
 *    salas/{codigo}                        ← una por actividad
 *       ├─ estado: "sala" | "pregunta" | "resultados" | "final"
 *       ├─ indiceActual: número            ← qué afirmación está activa
 *       ├─ afirmaciones: [ "...", ... ]     ← copia (posiblemente mezclada)
 *       ├─ bloqueada: bool                  ← respuestas cerradas para esta frase
 *       ├─ mostrarJustificaciones: bool
 *       ├─ permitirEdicion / mostrarNombres / permitirSeudonimo: bool
 *       ├─ segundosTemporizador: número
 *       ├─ inicioPreguntaMs: número        ← cuándo arrancó la frase (para el timer)
 *       └─ creadaEn: timestamp
 *
 *    salas/{codigo}/participantes/{idPart}
 *       ├─ nombre: string
 *       └─ ingresoEn: timestamp
 *
 *    salas/{codigo}/respuestas/{idPart_indice}
 *       ├─ idParticipante / nombre
 *       ├─ indice: número      ← posición de la afirmación
 *       ├─ afirmacion: string  ← texto completo (para exportar sin cruzar datos)
 *       ├─ opcion: "acuerdo" | "depende" | "desacuerdo"
 *       ├─ justificacion: string
 *       ├─ tiempoMs: número    ← cuánto tardó en responder
 *       └─ creadaEn: timestamp
 * ========================================================================== */

// SDK modular de Firebase (v10) servido desde el CDN oficial de Google.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, updateDoc, getDoc, getDocs,
  collection, onSnapshot, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

/* Inicializamos Firebase una sola vez y guardamos la referencia a Firestore. */
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* Reexportamos serverTimestamp por si algún módulo lo necesita. */
export { serverTimestamp };

/* --- Referencias cortas a documentos y colecciones -------------------------- */
const refSala          = (codigo) => doc(db, "salas", codigo);
const refParticipantes = (codigo) => collection(db, "salas", codigo, "participantes");
const refRespuestas    = (codigo) => collection(db, "salas", codigo, "respuestas");


/* ============================ SALA (documento raíz) ======================== */

/**
 * Crea una sala nueva con su configuración inicial.
 * @param {string} codigo  Código de ingreso (ej. "K7QP2").
 * @param {object} datos   Configuración de la sala (afirmaciones, ajustes...).
 */
export async function crearSala(codigo, datos) {
  await setDoc(refSala(codigo), {
    ...datos,
    estado: "sala",        // arranca en la "sala de espera" (lobby)
    indiceActual: -1,      // todavía no hay ninguna afirmación activa
    bloqueada: false,
    mostrarJustificaciones: true,
    inicioPreguntaMs: 0,
    creadaEn: serverTimestamp()
  });
}

/** Lee una sola vez el documento de la sala. Devuelve null si no existe. */
export async function obtenerSala(codigo) {
  const snap = await getDoc(refSala(codigo));
  return snap.exists() ? snap.data() : null;
}

/** Actualiza campos sueltos del documento de la sala (merge parcial). */
export async function actualizarSala(codigo, cambios) {
  await updateDoc(refSala(codigo), cambios);
}

/** Se suscribe en tiempo real a los cambios de la sala. Devuelve función para cortar. */
export function escucharSala(codigo, callback) {
  return onSnapshot(refSala(codigo), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}


/* ============================== PARTICIPANTES ============================== */

/** Registra a un participante en la sala. */
export async function unirseComoParticipante(codigo, idParticipante, nombre) {
  await setDoc(doc(refParticipantes(codigo), idParticipante), {
    nombre,
    ingresoEn: serverTimestamp()
  });
}

/** Escucha en tiempo real la lista de participantes. */
export function escucharParticipantes(codigo, callback) {
  return onSnapshot(refParticipantes(codigo), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}


/* =============================== RESPUESTAS ================================ */

/**
 * Guarda (o pisa, si se habilitó la edición) la respuesta de un participante
 * para una afirmación. El id combina participante + índice para que cada
 * persona tenga una sola respuesta por frase.
 */
export async function guardarRespuesta(codigo, idParticipante, indice, datos) {
  const idResp = `${idParticipante}_${indice}`;
  await setDoc(doc(refRespuestas(codigo), idResp), {
    idParticipante,
    indice,
    ...datos,
    creadaEn: serverTimestamp()
  });
}

/** Escucha en tiempo real TODAS las respuestas de la sala. */
export function escucharRespuestas(codigo, callback) {
  return onSnapshot(refRespuestas(codigo), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** Trae de una sola vez todas las respuestas (se usa al exportar). */
export async function obtenerTodasLasRespuestas(codigo) {
  const snap = await getDocs(query(refRespuestas(codigo), orderBy("indice")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
