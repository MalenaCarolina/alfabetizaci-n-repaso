/* =============================================================================
 *  config.js  —  ⭐ EL ÚNICO ARCHIVO QUE NECESITÁS EDITAR ⭐
 * -----------------------------------------------------------------------------
 *  Acá están las tres cosas que vas a querer cambiar:
 *    1) firebaseConfig  → las claves de tu proyecto de Firebase (ver README).
 *    2) AFIRMACIONES    → la lista de frases del debate. Agregá o quitá las que
 *                         quieras; podés poner cuantas necesites.
 *    3) AJUSTES_DEFECTO → cómo arranca cada sala nueva (temporizador, mezclar,
 *                         mostrar nombres, seudónimos, etc.).
 *
 *  No hace falta tocar ningún otro archivo para usar la aplicación.
 * ========================================================================== */


/* -----------------------------------------------------------------------------
 * 1) CLAVES DE FIREBASE
 * -----------------------------------------------------------------------------
 * Reemplazá los valores de ejemplo por los de TU proyecto.
 * Los encontrás en:  Consola de Firebase → ⚙ Configuración del proyecto →
 *                    "Tus apps" → app web → "Configuración del SDK".
 * (En el README están los pasos con capturas descritas.)
 *
 * ⚠ Estas claves NO son secretas: es normal que viajen al navegador. La
 *    seguridad real la dan las Reglas de Firestore (archivo firestore.rules).
 * -------------------------------------------------------------------------- */
export const firebaseConfig = {
 apiKey: "AIzaSyBvrMNutUUhQfsqbhlGGUEH5r5CEiaEenY",
 authDomain:  "alfabetizacion-clase.firebaseapp.com",
 projectId: "alfabetizacion-clase",
 storageBucket: "alfabetizacion-clase.firebasestorage.app",
 messagingSenderId: "88053687683",
 appId: "1:88053687683:web:d49cee28cf6d2ca1b942b6"
 measurementId: "G-DD8ZXVHGW1"
};


/* -----------------------------------------------------------------------------
 * 2) AFIRMACIONES DEL DEBATE
 * -----------------------------------------------------------------------------
 * Simplemente escribí una frase por línea entre comillas.
 * El orden es el que verá la clase (salvo que actives "mezclar" al crear la sala).
 * -------------------------------------------------------------------------- */
export const AFIRMACIONES = [
  "Saber leer y escribir alcanza para estar alfabetizado.",
  "Un adolescente que usa TikTok todo el día está alfabetizado.",
  "Una persona que terminó la escuela secundaria puede no estar plenamente alfabetizada.",
  "La inteligencia artificial obliga a redefinir la alfabetización.",
  "Existen muchas alfabetizaciones distintas, no una sola."
];


/* -----------------------------------------------------------------------------
 * 3) AJUSTES POR DEFECTO DE CADA SALA NUEVA
 * -----------------------------------------------------------------------------
 * La docente igual puede cambiar todo esto desde el panel al crear la sala;
 * esto es solo cómo aparecen las opciones marcadas por defecto.
 * -------------------------------------------------------------------------- */
export const AJUSTES_DEFECTO = {
  mezclarAfirmaciones: false, // barajar el orden de las frases al azar
  mostrarNombres:      false, // mostrar el nombre junto a cada justificación
  permitirSeudonimo:   true,  // dejar que ingresen con seudónimo en vez del nombre
  permitirEdicion:     false, // que puedan cambiar su respuesta antes del cierre
  segundosTemporizador: 0     // 0 = sin temporizador; ej. 60 = un minuto por frase
};


/* -----------------------------------------------------------------------------
 *  Definición de las tres opciones de respuesta.
 *  (Podés cambiar los textos o emojis, pero NO conviene cambiar las "clave":
 *   son las etiquetas internas que se guardan en la base de datos.)
 * -------------------------------------------------------------------------- */
export const OPCIONES = [
  { clave: "acuerdo",    emoji: "🟢", texto: "De acuerdo" },
  { clave: "depende",    emoji: "🟡", texto: "Depende" },
  { clave: "desacuerdo", emoji: "🔴", texto: "En desacuerdo" }
];

/* Longitud máxima permitida en el cuadro de justificación. */
export const MAX_CARACTERES_JUSTIFICACION = 400;
