/* =============================================================================
 *  config.js  —  ⭐ EL ÚNICO ARCHIVO QUE NECESITÁS EDITAR ⭐
 * -----------------------------------------------------------------------------
 *  Acá están las tres cosas que vas a querer cambiar:
 *    1) firebaseConfig  → las claves de tu proyecto de Firebase (ver README).
 *    2) PREGUNTAS       → la lista de preguntas/afirmaciones con su tipo.
 *    3) AJUSTES_DEFECTO → cómo arranca cada sala nueva.
 *
 *  TIPOS DE PREGUNTA DISPONIBLES:
 *    "debate"     → 🟢 De acuerdo / 🟡 Depende / 🔴 En desacuerdo + justificación
 *    "siNo"       → 🟢 De acuerdo / 🔴 En desacuerdo (sin Depende) + justificación
 *    "desarrollo" → solo un cuadro de texto libre (sin opciones)
 *    "multiple"   → casillas para marcar una o varias opciones + opción "otro"
 * ========================================================================== */


/* -----------------------------------------------------------------------------
 * 1) CLAVES DE FIREBASE
 * -------------------------------------------------------------------------- */
export const firebaseConfig = {
  apiKey: "AIzaSyBvrMNutUUhQfsqbhlGGUEH5r5CEiaEenY",
  authDomain: "alfabetizacion-clase.firebaseapp.com",
  projectId: "alfabetizacion-clase",
  storageBucket: "alfabetizacion-clase.firebasestorage.app",
  messagingSenderId: "88053687683",
  appId: "1:88053687683:web:d49cee28cf6d2ca1b942b6",
  measurementId: "G-DD8ZXVHGW1"
};


/* -----------------------------------------------------------------------------
 * 2) PREGUNTAS / AFIRMACIONES
 * -----------------------------------------------------------------------------
 * Cada pregunta tiene:
 *   texto  → lo que verá la clase
 *   tipo   → "debate" | "siNo" | "desarrollo" | "multiple"
 *   opciones → solo para tipo "multiple": array de strings con las opciones
 * -------------------------------------------------------------------------- */
export const PREGUNTAS = [
  {
    texto: "Saber leer y escribir alcanza para estar alfabetizado.",
    tipo: "debate"
  },
  {
    texto: "Un adolescente que usa TikTok todo el día está alfabetizado.",
    tipo: "debate"
  },
  {
    texto: "Una persona que terminó la escuela secundaria puede no estar plenamente alfabetizada.",
    tipo: "debate"
  },
  {
    texto: "La inteligencia artificial obliga a redefinir la alfabetización.",
    tipo: "debate"
  },
  {
    texto: "Existen muchas alfabetizaciones distintas, no una sola.",
    tipo: "debate"
  },
  {
    texto: "¿Todas las personas pueden aprender a leer y escribir?",
    tipo: "debate"
  },
  {
    texto: "¿Cómo aprendiste a leer y escribir?",
    tipo: "desarrollo"
  },
  {
    texto: "¿Cómo sería tu vida si no leyeras, si no escribieras?",
    tipo: "desarrollo"
  },
  {
    texto: "¿Cuáles son los condicionantes de este aprendizaje?",
    tipo: "multiple",
    opciones: [
      "El desarrollo biológico y neurológico.",
      "Las interacciones familiares y sociales.",
      "El contexto cultural y económico.",
      "Las experiencias previas del estudiante.",
      "La calidad de la enseñanza y las propuestas didácticas.",
      "La motivación, las emociones y el interés.",
      "El acceso a recursos y oportunidades de aprendizaje.",
      "Solo la inteligencia de la persona."
    ]
  },
  {
    texto: "¿Nacemos preparados para leer?",
    tipo: "siNo"
  }
];


/* -----------------------------------------------------------------------------
 * 3) AJUSTES POR DEFECTO DE CADA SALA NUEVA
 * -------------------------------------------------------------------------- */
export const AJUSTES_DEFECTO = {
  mezclarPreguntas:    false,
  mostrarNombres:      false,
  permitirSeudonimo:   true,
  permitirEdicion:     false,
  segundosTemporizador: 0
};


/* -----------------------------------------------------------------------------
 * Opciones de las preguntas tipo "debate" (🟢 / 🟡 / 🔴).
 * No conviene cambiar las "clave": son las etiquetas que se guardan en la BD.
 * -------------------------------------------------------------------------- */
export const OPCIONES_DEBATE = [
  { clave: "acuerdo",    emoji: "🟢", texto: "De acuerdo" },
  { clave: "depende",    emoji: "🟡", texto: "Depende" },
  { clave: "desacuerdo", emoji: "🔴", texto: "En desacuerdo" }
];

export const OPCIONES_SI_NO = [
  { clave: "acuerdo",    emoji: "🟢", texto: "De acuerdo" },
  { clave: "desacuerdo", emoji: "🔴", texto: "En desacuerdo" }
];

/* Longitud máxima del cuadro de texto libre. */
export const MAX_CARACTERES = 600;
