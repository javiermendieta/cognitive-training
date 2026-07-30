// Motor de generación de ejercicios cognitivos
// Basado en el plan de entrenamiento de 5 días, 10 min/día

// ============ UTILIDADES ============
export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatARS(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

// ============ TIPOS ============
export type ExerciseStatus = "pending" | "active" | "done" | "skipped";

export interface BaseExercise {
  id: string;
  type: string;
  prompt: string;
  // Función que valida la respuesta del usuario
  validate: (input: string) => { correct: boolean; expected: string; userAnswer: string };
  // Metadata para análisis
  skill: "buffer" | "calc" | "retention" | "multitask" | "speed" | "semantic";
  difficulty: 1 | 2 | 3;
}

// ============ LUNES: BUFFER DE TRABAJO ============

// 1. Suma mental de 3 dígitos
export function genSum3Digits(): BaseExercise {
  const nums = [rand(100, 999), rand(100, 999), rand(100, 999)];
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    id: crypto.randomUUID(),
    type: "sum3",
    prompt: `Sumá mentalmente: ${nums.join(" + ")}`,
    skill: "buffer",
    difficulty: 1,
    validate: (input) => {
      const n = parseInt(input.trim().replace(/[.,]/g, ""));
      return {
        correct: n === sum,
        expected: String(sum),
        userAnswer: input,
      };
    },
  };
}

// 2. Cadena de operaciones (5 pasos)
export function genOpChain(): BaseExercise {
  let current = rand(5, 20);
  const steps: string[] = [String(current)];
  const ops = ["+", "-", "×", "÷"];
  let display = String(current);

  for (let i = 0; i < 4; i++) {
    const op = pick(ops);
    let next: number;
    if (op === "+") {
      next = rand(2, 15);
      current += next;
    } else if (op === "-") {
      next = rand(2, Math.min(15, current - 1));
      current -= next;
    } else if (op === "×") {
      next = rand(2, 9);
      current *= next;
    } else {
      // división que dé entero
      next = rand(2, 9);
      current = Math.round(current / next);
    }
    display += ` ${op} ${next}`;
    steps.push(`${op} ${next}`);
  }

  const final = current;
  return {
    id: crypto.randomUUID(),
    type: "chain",
    prompt: `Cadena mental (una sola pasada): ${display} = ?`,
    skill: "buffer",
    difficulty: 3,
    validate: (input) => {
      const n = parseInt(input.trim().replace(/[.,]/g, ""));
      return {
        correct: n === final,
        expected: String(final),
        userAnswer: input,
      };
    },
  };
}

// 3. N-back visual (recordar secuencia)
export function genNBack(): BaseExercise {
  const length = rand(6, 9);
  const digits = Array.from({ length }, () => rand(0, 9));
  const targetIndex = rand(0, length - 3);
  const targetDigit = digits[targetIndex];
  const askIndex = targetIndex + 2; // 2-back
  return {
    id: crypto.randomUUID(),
    type: "nback",
    prompt: `Secuencia: ${digits.join(" ")}\n\n¿Qué número estaba 2 posiciones antes del último?`,
    skill: "buffer",
    difficulty: 2,
    validate: (input) => {
      const n = parseInt(input.trim());
      // El último es digits[length-1], 2 antes es digits[length-3]
      const expected = digits[length - 3];
      return {
        correct: n === expected,
        expected: String(expected),
        userAnswer: input,
      };
    },
  };
}

// ============ MARTES: CÁLCULO COTIDIANO ============

// 1. Vueltos con descuento
export function genVuelto(): BaseExercise {
  const price = rand(50, 500) * 100; // 5000 - 50000
  const discount = pick([5, 7, 8, 10, 12, 15, 20, 25]);
  const paid = (Math.ceil(price / 1000) * 1000) + rand(0, 5) * 1000; // billete grande
  const discountedPrice = price * (1 - discount / 100);
  const vuelto = paid - discountedPrice;
  return {
    id: crypto.randomUUID(),
    type: "vuelto",
    prompt: `Precio: ${formatARS(price)}\nDescuento: ${discount}%\nPagás con: ${formatARS(paid)}\n\n¿Vuelto?`,
    skill: "calc",
    difficulty: 2,
    validate: (input) => {
      const n = parseFloat(input.trim().replace(/[^\d.,-]/g, "").replace(",", "."));
      const ok = Math.abs(n - vuelto) < 5; // tolerancia $5
      return {
        correct: ok,
        expected: formatARS(vuelto),
        userAnswer: input,
      };
    },
  };
}

// 2. Porcentaje invertido (PUNTO CRÍTICO)
export function genPctInvertido(): BaseExercise {
  const pct = pick([10, 20, 25, 30, 40, 50]);
  const original = rand(10, 100) * 1000;
  const withDiscount = Math.round(original * (1 - pct / 100));
  return {
    id: crypto.randomUUID(),
    type: "pct_inv",
    prompt: `Precio con descuento ya aplicado: ${formatARS(withDiscount)}\nDescuento aplicado: ${pct}%\n\n¿Cuál era el precio ORIGINAL?`,
    skill: "calc",
    difficulty: 3,
    validate: (input) => {
      const n = parseFloat(input.trim().replace(/[^\d.,-]/g, "").replace(",", "."));
      const ok = Math.abs(n - original) < original * 0.02; // 2% tolerancia
      return {
        correct: ok,
        expected: formatARS(original),
        userAnswer: input,
      };
    },
  };
}

// 3. Multiplicación de 2 dígitos
export function genMult2(): BaseExercise {
  const a = rand(11, 99);
  const b = rand(11, 99);
  const result = a * b;
  return {
    id: crypto.randomUUID(),
    type: "mult2",
    prompt: `${a} × ${b} = ?`,
    skill: "calc",
    difficulty: 2,
    validate: (input) => {
      const n = parseInt(input.trim().replace(/[.,]/g, ""));
      return {
        correct: n === result,
        expected: String(result),
        userAnswer: input,
      };
    },
  };
}

// ============ MIÉRCOLES: RETENCIÓN ============

// Textos densos para retención
const TEXTOS_RETENCION: { texto: string; preguntas: { q: string; a: string }[] }[] = [
  {
    texto: "La empresa TechSolutions SA cerró el tercer trimestre con ingresos por $42,3 millones, un 18% más que el mismo trimestre del año anterior. El CEO, Martín Reyes, atribuyó el crecimiento a la expansión en mercados de México y Colombia, que ahora representan el 34% de la facturación total. Sin embargo, el margen operativo cayó del 22% al 17% por el aumento de costos en personal técnico, que subió un 30%. La CFO, Lucía Fernández, anunció un plan de eficiencia que incluye la reducción de 80 puestos administrativos y la inversión de $5,2 millones en automatización. El board aprobó el plan por 7 votos a 2, con la disidencia del director Ricardo Sosa, quien argumentó que el recorte afectaría la calidad del servicio al cliente.",
    preguntas: [
      { q: "¿Cuáles fueron los ingresos del Q3?", a: "$42,3 millones" },
      { q: "¿Qué porcentaje de la facturación viene de México y Colombia?", a: "34%" },
      { q: "¿Cuánto cayó el margen operativo (de qué a qué)?", a: "Del 22% al 17%" },
      { q: "¿Quién es el CFO?", a: "Lucía Fernández" },
      { q: "¿Cuántos puestos se van a reducir?", a: "80" },
      { q: "¿Quién fue el director disidente?", a: "Ricardo Sosa" },
    ],
  },
  {
    texto: "El nuevo protocolo de seguridad de la cadena de suministro establece que todo contenedor proveniente de Asia debe ser inspeccionado en el puerto de ingreso dentro de las 48 horas de llegada. El responsable de logística, Diego Romero, implementó el sistema el 15 de marzo. Hasta abril se detectaron 23 incidencias, de las cuales 17 correspondían a errores de documentación y 6 a sobrepeso. El costo promedio de cada incidencia fue de $1.840. La gerente de operaciones, Patricia Limas, propuso contratar 4 inspectores adicionales a $3.200 mensuales cada uno. Diego objetó que con $8.000 en software de pre-chequeo podían reducir las incidencias un 60%. Patricia respondió que el software no resolvía los casos de sobrepeso, que requerían inspección física obligatoria.",
    preguntas: [
      { q: "¿En cuántas horas debe inspeccionarse un contenedor?", a: "48" },
      { q: "¿Cuándo se implementó el sistema?", a: "15 de marzo" },
      { q: "¿Cuántas incidencias se detectaron hasta abril?", a: "23" },
      { q: "¿Cuántas fueron por sobrepeso?", a: "6" },
      { q: "¿Quién propuso contratar inspectores?", a: "Patricia Limas" },
      { q: "¿Cuánto costaba el software de pre-chequeo?", a: "$8.000" },
    ],
  },
  {
    texto: "La cooperativa La Solidaria lanzó un programa de microcréditos para emprendedores rurales. El fondo inicial fue de $18 millones, aportado por 12 inversores privados y el Ministerio de Desarrollo Productivo, que puso el 40%. Cada préstamo promedia $350.000 con una tasa del 9% anual, 6 puntos por debajo del mercado. La coordinadora, Ana Beltrán, reportó que en los primeros 4 meses se otorgaron 87 préstamos, de los cuales 12 fueron a mujeres jefas de hogar. La tasa de morosidad fue del 3,5%, inferior al 8% promedio del sector. El directorio aprobó ampliar el fondo a $25 millones para el segundo semestre, con la condición de que al menos 30 nuevos préstamos fueran a mujeres.",
    preguntas: [
      { q: "¿Cuál era el fondo inicial?", a: "$18 millones" },
      { q: "¿Cuántos inversores privados participaron?", a: "12" },
      { q: "¿Qué porcentaje puso el Ministerio?", a: "40%" },
      { q: "¿Cuál es el promedio de cada préstamo?", a: "$350.000" },
      { q: "¿Cuántos préstamos se otorgaron en 4 meses?", a: "87" },
      { q: "¿Cuántos fueron a mujeres jefas de hogar?", a: "12" },
    ],
  },
];

export interface RetentionExercise extends BaseExercise {
  type: "retention";
  text: string;
  questions: { q: string; a: string }[];
}

export function genRetention(): RetentionExercise {
  const item = pick(TEXTOS_RETENCION);
  return {
    id: crypto.randomUUID(),
    type: "retention",
    prompt: "Leé el texto UNA sola vez. Después tapá el texto y respondé las preguntas.",
    skill: "retention",
    difficulty: 3,
    text: item.texto,
    questions: item.preguntas,
    validate: (input) => ({
      correct: false,
      expected: "",
      userAnswer: input,
    }),
  };
}

// ============ JUEVES: MULTITAREA + FRONTERAS ============

// Escenarios tipo cafetería
export interface MultitaskScenario extends BaseExercise {
  type: "multitask";
  scenario: string;
  questions: { q: string; a: string; hint?: string }[];
}

export function genMultitask(): MultitaskScenario {
  const scenarios: MultitaskScenario[] = [
    {
      id: crypto.randomUUID(),
      type: "multitask",
      prompt: "Leé una sola vez. Sin anotar. Respondé de memoria.",
      skill: "multitask",
      difficulty: 3,
      scenario:
        "Estás coordinando un restaurante el sábado a la noche. Tenés 4 mesas activas:\n" +
        "- Mesa 3 pidió a las 20:15, demora 25 min\n" +
        "- Mesa 7 pidió a las 20:30, demora 15 min\n" +
        "- Mesa 12 pidió a las 20:40, demora 30 min\n" +
        "- Mesa 5 pidió a las 20:50, demora 20 min\n\n" +
        "El horno se limpia cada 6 pedidos. Llevás 4 desde la última limpieza.\n" +
        "El proveedor de vino llama a las 21:00. Necesitás saber cuántas botellas pedir. Abriste con 24, vendiste 17 (1 por mesa con vino).\n" +
        "Un cliente VIP llega a las 21:10. Si su pedido entra antes de las 21:20, te deja 25% extra de propina.",
      questions: [
        { q: "¿A qué hora está lista la Mesa 7?", a: "20:45" },
        { q: "¿A qué hora está lista la Mesa 5?", a: "21:10" },
        { q: "¿Cuántas botellas de vino te quedan a las 21:00?", a: "7" },
        { q: "¿Después de qué pedido se dispara la limpieza del horno?", a: "Después del 6to pedido (es decir, después de los 2 próximos)" },
        { q: "Si el VIP pide a las 21:15, ¿hay propina extra?", a: "Sí (antes de 21:20)" },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "multitask",
      prompt: "Leé una sola vez. Sin anotar. Respondé de memoria.",
      skill: "multitask",
      difficulty: 3,
      scenario:
        "Coordinás una flota de 5 remises el viernes a la mañana.\n" +
        "- Auto A sale 8:00, viaje de 45 min\n" +
        "- Auto B sale 8:15, viaje de 30 min\n" +
        "- Auto C sale 8:30, viaje de 60 min\n" +
        "- Auto D sale 8:45, viaje de 25 min\n" +
        "- Auto E sale 9:00, viaje de 40 min\n\n" +
        "Cada auto necesita carga completa de nafta cada 200 km. Promedio 50 km/h, todos arrancaron con tanque lleno (300 km de autonomía).\n" +
        "Un cliente VIP pide un auto para las 9:20. Solo acepta si sale antes de las 9:30.\n" +
        "El taller llama a las 9:00: tienen lugar para revisar 1 auto. Cobran $4.500. Si no lo llevás hoy, el próximo turno es en 2 semanas.",
      questions: [
        { q: "¿A qué hora vuelve el Auto B?", a: "8:45" },
        { q: "¿A qué hora vuelve el Auto C?", a: "9:30" },
        { q: "¿Qué auto puede tomar el VIP a las 9:20?", a: "El B (vuelve 8:45) o el D (vuelve 9:10), pero no el A (vuelve 8:45 también) — cualquiera que vuelva antes de 9:20" },
        { q: "¿Cuándo necesita nafta el Auto C?", a: "Después de 200 km = 4 horas de viaje, es decir nunca ese día (viaje es de 60 min)" },
        { q: "¿El VIP acepta si sale a las 9:30 en punto?", a: "No (la regla era 'antes de las 9:30')" },
      ],
    },
  ];
  return pick(scenarios);
}

// Fronteras semánticas (antes de / después de / hasta / desde)
export function genBoundary(): BaseExercise {
  const casos: { enunciado: string; afirmacion: string; correcta: boolean }[] = [
    { enunciado: "La oferta es válida hasta el 15 de marzo inclusive.", afirmacion: "Hoy es 15 de marzo. ¿Aplica la oferta?", correcta: true },
    { enunciado: "La oferta es válida hasta el 15 de marzo (no inclusive).", afirmacion: "Hoy es 15 de marzo. ¿Aplica la oferta?", correcta: false },
    { enunciado: "Debés entregar el informe antes del viernes.", afirmacion: "Hoy es viernes 9 AM. ¿Cumpliste si entregás ahora?", correcta: false },
    { enunciado: "Debés entregar el informe antes del viernes.", afirmacion: "Hoy es jueves 23:59. ¿Cumpliste si entregás ahora?", correcta: true },
    { enunciado: "El descuento aplica desde el 1 de mayo.", afirmacion: "Hoy es 1 de mayo. ¿Aplica?", correcta: true },
    { enunciado: "El descuento aplica desde el 1 de mayo.", afirmacion: "Hoy es 30 de abril. ¿Aplica?", correcta: false },
    { enunciado: "La promoción es para los primeros 50 clientes.", afirmacion: "Sos el cliente 50. ¿Te toca promoción?", correcta: true },
    { enunciado: "La promoción es para los primeros 50 clientes.", afirmacion: "Sos el cliente 51. ¿Te toca promoción?", correcta: false },
    { enunciado: "El plan aumenta a partir del mes 12.", afirmacion: "Estás en el mes 12. ¿Te aumentan?", correcta: true },
    { enunciado: "El plan aumenta a partir del mes 12.", afirmacion: "Estás en el mes 11. ¿Te aumentan?", correcta: false },
  ];
  const caso = pick(casos);
  return {
    id: crypto.randomUUID(),
    type: "boundary",
    prompt: `${caso.enunciado}\n\n${caso.afirmacion}`,
    skill: "semantic",
    difficulty: 1,
    validate: (input) => {
      const cleaned = input.trim().toLowerCase();
      const isYes = ["si", "sí", "yes", "s", "aplica", "true", "1"].includes(cleaned);
      return {
        correct: isYes === caso.correcta,
        expected: caso.correcta ? "SÍ" : "NO",
        userAnswer: input,
      };
    },
  };
}

// ============ VIERNES: VELOCIDAD ============

export function genSpeedExercise(): BaseExercise {
  const tipo = pick(["sum2", " mult2", "pct", "vuelto_simple"]);
  if (tipo === "sum2") {
    const a = rand(10, 99);
    const b = rand(10, 99);
    const r = a + b;
    return {
      id: crypto.randomUUID(),
      type: "speed_sum",
      prompt: `${a} + ${b} = ?`,
      skill: "speed",
      difficulty: 1,
      validate: (input) => ({
        correct: parseInt(input.trim()) === r,
        expected: String(r),
        userAnswer: input,
      }),
    };
  }
  if (tipo === " mult2") {
    const a = rand(11, 30);
    const b = rand(2, 9);
    const r = a * b;
    return {
      id: crypto.randomUUID(),
      type: "speed_mult",
      prompt: `${a} × ${b} = ?`,
      skill: "speed",
      difficulty: 1,
      validate: (input) => ({
        correct: parseInt(input.trim()) === r,
        expected: String(r),
        userAnswer: input,
      }),
    };
  }
  if (tipo === "pct") {
    const base = pick([100, 200, 300, 400, 500, 600, 800, 1000]);
    const pct = pick([10, 20, 25, 50, 5, 15]);
    const r = (base * pct) / 100;
    return {
      id: crypto.randomUUID(),
      type: "speed_pct",
      prompt: `${pct}% de ${base} = ?`,
      skill: "speed",
      difficulty: 1,
      validate: (input) => ({
        correct: parseInt(input.trim()) === r,
        expected: String(r),
        userAnswer: input,
      }),
    };
  }
  // vuelto simple
  const price = rand(5, 95) * 10;
  const paid = Math.ceil(price / 100) * 100;
  const r = paid - price;
  return {
    id: crypto.randomUUID(),
    type: "speed_vuelto",
    prompt: `Precio: $${price}\nPagás: $${paid}\n¿Vuelto?`,
    skill: "speed",
    difficulty: 1,
    validate: (input) => ({
      correct: parseInt(input.trim().replace(/[^\d-]/g, "")) === r,
      expected: String(r),
      userAnswer: input,
    }),
  };
}

// ============ SESIONES POR DÍA ============

export interface SessionPlan {
  day: "lunes" | "martes" | "miercoles" | "jueves" | "viernes";
  title: string;
  subtitle: string;
  focus: string;
  exercises: () => BaseExercise[];
  durationMin: number;
}

export const SESSIONS: Record<SessionPlan["day"], SessionPlan> = {
  lunes: {
    day: "lunes",
    title: "Buffer de trabajo",
    subtitle: "Suma mental + cadenas + N-back",
    focus: "Romper el cuello de botella del buffer de 2 elementos",
    durationMin: 10,
    exercises: () => [
      genSum3Digits(), genSum3Digits(), genSum3Digits(), genSum3Digits(), genSum3Digits(),
      genOpChain(), genOpChain(), genOpChain(), genOpChain(), genOpChain(),
      genNBack(), genNBack(), genNBack(),
    ],
  },
  martes: {
    day: "martes",
    title: "Cálculo cotidiano",
    subtitle: "Vueltos + % invertido + multiplicación",
    focus: "PUNTO CRÍTICO: porcentaje invertido. No te saltes este día.",
    durationMin: 10,
    exercises: () => [
      genVuelto(), genVuelto(), genVuelto(), genVuelto(),
      genPctInvertido(), genPctInvertido(), genPctInvertido(), genPctInvertido(),
      genPctInvertido(), genPctInvertido(),
      genMult2(), genMult2(), genMult2(),
    ],
  },
  miercoles: {
    day: "miercoles",
    title: "Retención bajo fricción",
    subtitle: "Lectura densa → preguntas de memoria",
    focus: "Una sola pasada. Sin anotar. Sin volver arriba.",
    durationMin: 10,
    exercises: () => [genRetention()],
  },
  jueves: {
    day: "jueves",
    title: "Multitarea y fronteras",
    subtitle: "Escenarios complejos + procesamiento semántico fino",
    focus: "Fronteras (antes de / hasta / desde) y 4ta opción generada.",
    durationMin: 10,
    exercises: () => [
      genMultitask(),
      genBoundary(), genBoundary(), genBoundary(),
      genBoundary(), genBoundary(), genBoundary(),
    ],
  },
  viernes: {
    day: "viernes",
    title: "Velocidad bajo presión",
    subtitle: "20 cálculos en 10 minutos cronometrados",
    focus: "Velocidad, no perfección. Si te equivocás, pasás al siguiente.",
    durationMin: 10,
    exercises: () => Array.from({ length: 20 }, () => genSpeedExercise()),
  },
};

export const DAY_ORDER: SessionPlan["day"][] = ["lunes", "martes", "miercoles", "jueves", "viernes"];

// Dado un Date, devuelve el día de la sesión correspondiente
export function getTodaySession(): SessionPlan["day"] {
  const dayIdx = (new Date().getDay() + 6) % 7; // lunes=0, domingo=6
  if (dayIdx >= 5) return "lunes"; // fin de semana → lunes
  return DAY_ORDER[dayIdx];
}
