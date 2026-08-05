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

// ============ VALIDACIÓN DE RESPUESTAS (smart matching) ============
// Normaliza texto: minúsculas, sin acentos, sin puntuación, espacios colapsados.
// Pensado para comparar respuestas del usuario contra la respuesta esperada
// tolerando variantes de tipeo en español (AR).
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos (acentos, tildes)
    .replace(/[.$,;:!?¡¿"'`´()]/g, " ") // puntuación → espacio
    .replace(/\s+/g, " ")
    .trim();
}

// Parsea un literal numérico tipo "3.500" (miles AR), "42,3" (decimal),
// "4.500,50" (mixto AR) o "3500" a number.
function parseNumLiteral(m: string): number {
  const dots = (m.match(/\./g) || []).length;
  const commas = (m.match(/,/g) || []).length;
  if (dots === 0 && commas === 0) return parseInt(m, 10);
  if (commas > 0 && dots === 0) {
    const parts = m.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(parts[0] + "." + parts[1]);
    }
    return parseInt(m.replace(/,/g, ""), 10);
  }
  if (dots > 0 && commas === 0) {
    const parts = m.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(m);
    }
    return parseInt(m.replace(/\./g, ""), 10);
  }
  // Ambos: asumimos formato AR (punto=miles, coma=decimal)
  return parseFloat(m.replace(/\./g, "").replace(",", "."));
}

// Extrae números de un texto, respetando sufijos de magnitud
// ("millones", "mil", "m", "k"). Devuelve el valor numérico real.
export function extractNumbers(s: string): number[] {
  const lower = s.toLowerCase();
  const regex = /(\d[\d.,]*\d|\d)\s*(millones?|mill[oó]n|millon|m\b|mil\b|k\b)?/g;
  const matches = [...lower.matchAll(regex)];
  return matches
    .map((m) => {
      const n = parseNumLiteral(m[1]);
      const suffix = m[2];
      if (suffix) {
        if (suffix.startsWith("millon") || suffix === "m") return n * 1_000_000;
        if (suffix.startsWith("mil") || suffix === "k") return n * 1_000;
      }
      return n;
    })
    .filter((n) => !isNaN(n));
}

const YES_WORDS = [
  "si", "sip", "yes", "s", "verdad", "verdadero", "true", "aplica",
  "completa", "completo", "cierto", "ok", "vale",
];
const NO_WORDS = [
  "no", "nop", "false", "falso", "falsa",
  "incompleta", "incompleto", "falta", "nada",
];

// Divide una respuesta en tokens usando separadores de lista (+, " y ", coma).
// IMPORTANTE: se hace sobre el string ORIGINAL (pre-normalización) para no perder
// las comas. Se evita splitear comas que son separador decimal (seguidas de dígito).
function splitTokens(s: string): string[] {
  return s
    .split(/\s*\+\s*|\s+y\s+|,\s*(?=[a-zA-Z])/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

// Detecta si una respuesta es "puramente numérica": un número con formatos
// opcionales ($, ".", ",", "millones", "mil", "pesos"). Si es así, el match
// numérico por sí solo basta para considerarla correcta.
function isPureNumeric(s: string): boolean {
  const cleaned = s
    .toLowerCase()
    .replace(/millones?|mill[oó]n|millon|mil|pesos|argentinos?|ars|\$|\.|,/g, "")
    .replace(/\s+/g, "")
    .trim();
  return /^\d+$/.test(cleaned) && cleaned.length > 0;
}

// Comparador tolerante de respuestas.
// 1. Igualdad exacta (post-normalización)
// 2. Detección de Sí/No por palabras clave
// 3. Listas: si la respuesta esperada tiene varios tokens (separados por +, coma, " y "),
//    TODOS deben aparecer en la respuesta del usuario
// 4. Numérico: comparación estricta para <1M, tolerancia 0.1% para millones
// 5. Substring (uno contiene al otro) + token-level matching
export function smartMatch(userAnswer: string, expected: string): boolean {
  const a = normalizeText(userAnswer);
  const e = normalizeText(expected);
  if (!a) return false;
  if (a === e) return true;

  // --- Sí/No (palabras clave) ---
  const eWordsArr = e.split(/\s+/);
  const aWordsArr = a.split(/\s+/);
  const isEYes = eWordsArr.some((w) => YES_WORDS.includes(w));
  const isENo = eWordsArr.some((w) => NO_WORDS.includes(w));
  if (isEYes && !isENo) {
    const isAYes = aWordsArr.some((w) => YES_WORDS.includes(w));
    const isANo = aWordsArr.some((w) => NO_WORDS.includes(w));
    return isAYes && !isANo;
  }
  if (isENo && !isEYes) {
    const isAYes = aWordsArr.some((w) => YES_WORDS.includes(w));
    const isANo = aWordsArr.some((w) => NO_WORDS.includes(w));
    return isANo && !isAYes;
  }

  // --- Listas (multi-token, sobre string original) ---
  const eTokensRaw = splitTokens(expected);
  if (eTokensRaw.length > 1) {
    const aTokensRaw = splitTokens(userAnswer);
    return eTokensRaw.every((eTokRaw) => {
      const eTokNorm = normalizeText(eTokRaw);
      const eSlice = eTokNorm.slice(0, Math.min(5, eTokNorm.length));
      if (a.includes(eSlice)) return true;
      return aTokensRaw.some((aTokRaw) => {
        const aTok = normalizeText(aTokRaw);
        const aSlice = aTok.slice(0, Math.min(5, aTok.length));
        return aTok.includes(eSlice) || eTokNorm.includes(aSlice);
      });
    });
  }

  // --- Numérico ---
  const aNums = extractNumbers(userAnswer);
  const eNums = extractNumbers(expected);
  if (eNums.length > 0 && aNums.length > 0) {
    const numClose = (x: number, y: number): boolean => {
      if (x === y) return true;
      const diff = Math.abs(x - y);
      const absMax = Math.max(Math.abs(x), Math.abs(y), 1);
      const ratio = diff / absMax;
      // Para números < 1M, exigir match exacto (precios, cantidades, años)
      if (absMax < 1_000_000) return false;
      // Para millones, permitir 0.1% de tolerancia
      return ratio < 0.001;
    };
    if (aNums.length === eNums.length) {
      const allMatch = eNums.every((eNum, i) => numClose(aNums[i], eNum));
      if (!allMatch) return false; // algún número no coincide → rechazar
      // Si la respuesta es puramente numérica (número + sufijos), el match numérico basta
      if (isPureNumeric(expected) || isPureNumeric(userAnswer)) {
        return true;
      }
      // Si hay texto sustancial en ambos, caer al check de texto abajo
    } else {
      // Diferente cantidad de números → todos los del expected deben estar en el user
      const allPresent = eNums.every((eNum) =>
        aNums.some((aNum) => numClose(aNum, eNum))
      );
      if (!allPresent) return false;
      // Si todos están presentes y la respuesta es puramente numérica, aceptar
      if (isPureNumeric(expected) || isPureNumeric(userAnswer)) {
        return true;
      }
    }
  }

  // --- Substring (uno contiene al otro, post-normalización) ---
  if (a.includes(e) || e.includes(a)) return true;

  // --- Token-level: cada palabra del user debe aparecer en el expected ---
  const aWordList = a.split(/\s+/).filter((w) => w.length >= 2);
  const eWordList = e.split(/\s+/).filter((w) => w.length >= 2);
  if (aWordList.length > 0 && eWordList.length > 0) {
    const allUserWordsMatch = aWordList.every((aw) =>
      eWordList.some((ew) => ew.includes(aw) || aw.includes(ew))
    );
    if (allUserWordsMatch) return true;
  }

  return false;
}

// Máximo común divisor (para simplificar fracciones)
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// ============ TIPOS ============
export type ExerciseStatus = "pending" | "active" | "done" | "skipped";

export interface TimedImage {
  url: string;
  label: string;
}

export interface BaseExercise {
  id: string;
  type: string;
  prompt: string;
  // Función que valida la respuesta del usuario
  validate: (input: string) => { correct: boolean; expected: string; userAnswer: string };
  // Metadata para análisis
  skill: "buffer" | "calc" | "retention" | "multitask" | "speed" | "semantic";
  difficulty: 1 | 2 | 3;
  // Para ejercicios con timer: mostrar contenido X segundos y ocultar
  // antes de mostrar el prompt y pedir la respuesta.
  // Esto evita que el usuario "espíe" la secuencia al responder.
  timedDisplay?: { content: string; durationMs: number };
  timedImages?: TimedImage[];
  timedDurationMs?: number;
  // Para ejercicios de asociación: imagen que se muestra DURANTE la fase
  // de respuesta (no solo en la fase de memorización). Ej: rostros →
  // memorizás varios, después se muestra uno y preguntás el nombre.
  answerImage?: { url: string; alt?: string };
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

// 2. Cadena de operaciones (5 pasos) con dificultad progresiva
// Las primeras operaciones son más fáciles, las últimas más difíciles
// Las divisiones siempre son exactas (buscamos divisor válido)
export function genOpChain(): BaseExercise {
  // Dificultad creciente: empezamos con números chicos y operaciones simples,
  // vamos subiendo. Paso 1-2: +,- con chicos. Paso 3-4: ×,÷. Paso 5: mix.
  let current = rand(8, 25);
  let display = String(current);

  // Tres niveles de dificultad para los operandos
  const diffRanges = [
    { addMax: 12, subMax: 10, multMax: 6, divMax: 5 }, // paso 1
    { addMax: 15, subMax: 12, multMax: 7, divMax: 7 }, // paso 2
    { addMax: 18, subMax: 15, multMax: 8, divMax: 9 }, // paso 3
    { addMax: 20, subMax: 18, multMax: 9, divMax: 9 }, // paso 4
    { addMax: 25, subMax: 20, multMax: 9, divMax: 9 }, // paso 5
  ];

  for (let step = 0; step < 5; step++) {
    const dr = diffRanges[step];
    // Operaciones posibles según dificultad del paso
    const ops = step < 2 ? ["+", "-"] : step < 4 ? ["+", "-", "×", "÷"] : ["+", "-", "×", "÷", "÷"];
    let op = pick(ops);
    let next = 0;

    if (op === "÷") {
      // Buscar divisores de current que den entero >= 1
      const maxDiv = Math.min(dr.divMax, current);
      const divisors: number[] = [];
      for (let d = 2; d <= maxDiv; d++) {
        if (current % d === 0 && current / d >= 1) divisors.push(d);
      }
      if (divisors.length === 0) {
        // No hay divisor válido, cambiar a multiplicación
        op = "×";
        next = rand(2, dr.multMax);
        current *= next;
      } else {
        next = pick(divisors);
        current = current / next; // división exacta, sin redondeo
      }
    } else if (op === "+") {
      next = rand(2, dr.addMax);
      current += next;
    } else if (op === "-") {
      // Evitar negativos o current muy chico
      const maxSub = Math.min(dr.subMax, current - 1);
      if (maxSub < 2) {
        // current muy chico, cambiar a suma
        op = "+";
        next = rand(2, dr.addMax);
        current += next;
      } else {
        next = rand(2, maxSub);
        current -= next;
      }
    } else if (op === "×") {
      next = rand(2, dr.multMax);
      current *= next;
    }

    display += ` ${op} ${next}`;
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

// 3. N-back visual (recordar secuencia con timer)
// La secuencia se muestra X segundos y desaparece antes de preguntar
export function genNBack(opts?: { itemsCount?: number }): BaseExercise {
  const length = opts?.itemsCount ?? rand(6, 9);
  const digits = Array.from({ length }, () => rand(0, 9));

  // Variantes de pregunta para evitar automatismo
  const variant = pick(["before_last", "position_n", "after_x"]);
  let question: string;
  let expected: number;

  if (variant === "before_last") {
    // 2 posiciones antes del último = índice length-3
    expected = digits[length - 3];
    question = "¿Qué número estaba 2 posiciones antes del ÚLTIMO?";
  } else if (variant === "position_n") {
    // Preguntar por una posición específica
    const pos = rand(2, length - 1); // posición 1-indexed
    expected = digits[pos - 1];
    question = `¿Qué número estaba en la posición ${pos}?`;
  } else {
    // ¿Qué venía después del número X? (X es uno de los dígitos)
    const askIdx = rand(0, length - 2);
    const targetDigit = digits[askIdx];
    expected = digits[askIdx + 1];
    question = `¿Qué número venía DESPUÉS del ${targetDigit}?`;
  }

  return {
    id: crypto.randomUUID(),
    type: "nback",
    prompt: question,
    skill: "buffer",
    difficulty: 2,
    timedDisplay: {
      content: digits.join("   "),
      durationMs: length * 900, // 900ms por dígito
    },
    validate: (input) => {
      const n = parseInt(input.trim());
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

// 4. Operaciones con fracciones (siempre exactas, simplificadas)
// Acepta respuesta como "a/b" o como decimal
export function genFraction(): BaseExercise {
  // Denominadores que dan fracciones manejables
  const denominadores = [2, 3, 4, 5, 6, 8, 10, 12];
  let d1 = pick(denominadores);
  let d2 = pick(denominadores.filter((d) => d !== d1));
  let n1 = rand(1, d1 - 1);
  let n2 = rand(1, d2 - 1);
  const op = pick(["+", "-", "×"]);

  let numRes: number;
  let denRes: number;

  if (op === "+") {
    numRes = n1 * d2 + n2 * d1;
    denRes = d1 * d2;
  } else if (op === "-") {
    // Asegurar que el resultado sea positivo: n1/d1 > n2/d2  =>  n1*d2 > n2*d1
    if (n1 * d2 <= n2 * d1) {
      // swap
      [n1, n2] = [n2, n1];
      [d1, d2] = [d2, d1];
    }
    numRes = n1 * d2 - n2 * d1;
    denRes = d1 * d2;
  } else {
    // multiplicación
    numRes = n1 * n2;
    denRes = d1 * d2;
  }

  // Simplificar
  const g = gcd(numRes, denRes);
  numRes /= g;
  denRes /= g;

  // Si el denominador es 1, el resultado es entero
  const expected = denRes === 1 ? String(numRes) : `${numRes}/${denRes}`;
  const expectedVal = numRes / denRes;

  return {
    id: crypto.randomUUID(),
    type: "fraction",
    prompt: `${n1}/${d1} ${op} ${n2}/${d2} = ?`,
    skill: "calc",
    difficulty: 3,
    validate: (input) => {
      const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
      let userVal: number | null = null;
      if (cleaned.includes("/")) {
        const parts = cleaned.split("/");
        if (parts.length === 2) {
          const a = parseFloat(parts[0]);
          const b = parseFloat(parts[1]);
          if (!isNaN(a) && !isNaN(b) && b !== 0) userVal = a / b;
        }
      } else {
        const v = parseFloat(cleaned);
        if (!isNaN(v)) userVal = v;
      }
      const ok = userVal !== null && Math.abs(userVal - expectedVal) < 0.005;
      return {
        correct: ok,
        expected,
        userAnswer: input,
      };
    },
  };
}

// ============ MEMORIA DE NOMBRES Y ROSTROS ============

const NOMBRES = [
  "María", "Juan", "Lucía", "Pedro", "Ana", "Carlos", "Sofía", "Diego",
  "Elena", "Pablo", "Carmen", "Mateo", "Valeria", "Tomás", "Renata", "Bruno",
  "Florencia", "Joaquín", "Dolores", "Nicolás", "Catalina", "Emilio",
  "Mercedes", "Ramiro", "Pilar", "Santiago", "Inés", "Federico", "Cecilia",
  "Augusto", "Manuela", "Vicente", "Josefina", "Bautista", "Antonia",
];

// Nombres separados por género, para que el ejercicio de rostros asigne
// nombres que coincidan con el género de la foto.
const NOMBRES_HOMBRES = [
  "Juan", "Pedro", "Carlos", "Diego", "Pablo", "Mateo", "Tomás", "Bruno",
  "Joaquín", "Nicolás", "Emilio", "Ramiro", "Santiago", "Federico",
  "Augusto", "Vicente", "Bautista",
];
const NOMBRES_MUJERES = [
  "María", "Lucía", "Ana", "Sofía", "Elena", "Carmen", "Valeria", "Renata",
  "Florencia", "Dolores", "Catalina", "Mercedes", "Pilar", "Inés", "Cecilia",
  "Manuela", "Josefina", "Antonia",
];

// randomuser.me/api/portraits tiene 0-99 índices separados por género.
// Esto garantiza que la foto coincida con el género del nombre asignado,
// a diferencia de pravatar.cc que mezcla géneros sin orden conocido.
function pickGenderedFace(gender: "hombre" | "mujer", used: Set<number>): { url: string; idx: number } {
  const folder = gender === "hombre" ? "men" : "women";
  let idx: number;
  let attempts = 0;
  do {
    idx = rand(0, 99);
    attempts++;
  } while (used.has(idx) && attempts < 50);
  used.add(idx);
  return { url: `https://randomuser.me/api/portraits/${folder}/${idx}.jpg`, idx };
}

// Memoria de nombres: muestra una lista de nombres por X segundos, los oculta,
// y pregunta por uno de ellos (posición, antes, después, etc.)
export function genNames(opts?: { itemsCount?: number }): BaseExercise {
  const count = opts?.itemsCount ?? rand(4, 6);
  const shuffled = [...NOMBRES].sort(() => Math.random() - 0.5).slice(0, count);

  // Variantes de pregunta
  const variant = pick(["position", "after", "before", "first_last"]);
  let question: string;
  let expected: string;

  if (variant === "position") {
    const pos = rand(1, count);
    expected = shuffled[pos - 1];
    question = `¿Qué nombre estaba en la posición ${pos}?`;
  } else if (variant === "after" && count > 1) {
    const idx = rand(0, count - 2);
    expected = shuffled[idx + 1];
    question = `¿Qué nombre venía DESPUÉS de ${shuffled[idx]}?`;
  } else if (variant === "before" && count > 1) {
    const idx = rand(1, count - 1);
    expected = shuffled[idx - 1];
    question = `¿Qué nombre venía ANTES de ${shuffled[idx]}?`;
  } else {
    // first/last
    if (Math.random() < 0.5) {
      expected = shuffled[0];
      question = `¿Cuál era el PRIMER nombre de la lista?`;
    } else {
      expected = shuffled[count - 1];
      question = `¿Cuál era el ÚLTIMO nombre de la lista?`;
    }
  }

  return {
    id: crypto.randomUUID(),
    type: "names",
    prompt: question,
    skill: "retention",
    difficulty: 2,
    timedDisplay: {
      content: shuffled.map((n, i) => `${i + 1}. ${n}`).join("\n"),
      durationMs: count * 1800, // 1.8s por nombre
    },
    validate: (input) => {
      const ok = smartMatch(input, expected);
      return {
        correct: ok,
        expected,
        userAnswer: input,
      };
    },
  };
}

// Memoria de rostros: muestra fotos con nombres por X segundos, las oculta,
// y después muestra UNA foto y pregunta "¿cómo se llama esta persona?".
// Usa randomuser.me (separa hombres y mujeres) para que el género del
// nombre asignado coincida con el de la foto.
export function genFaces(opts?: { itemsCount?: number }): BaseExercise {
  const count = opts?.itemsCount ?? rand(3, 4);
  const usedIdx = new Set<number>();

  // Decidir géneros aleatorios para cada foto
  const genders: ("hombre" | "mujer")[] = Array.from({ length: count }, () =>
    Math.random() < 0.5 ? "hombre" : "mujer"
  );

  // Asignar nombres del género correcto (sin repetir)
  const usedNames = new Set<string>();
  const faces: TimedImage[] = genders.map((g) => {
    const pool = g === "hombre" ? NOMBRES_HOMBRES : NOMBRES_MUJERES;
    const available = pool.filter((n) => !usedNames.has(n));
    const name = available.length > 0 ? pick(available) : pick(pool);
    usedNames.add(name);
    const face = pickGenderedFace(g, usedIdx);
    return { url: face.url, label: name };
  });

  // Elegir cuál de las fotos se va a mostrar en la fase de respuesta
  const askIdx = rand(0, count - 1);
  const expected = faces[askIdx].label;
  const question = "¿Cómo se llama esta persona?";

  return {
    id: crypto.randomUUID(),
    type: "faces",
    prompt: question,
    skill: "retention",
    difficulty: 3,
    timedImages: faces,
    timedDurationMs: count * 2800, // 2.8s por rostro
    answerImage: { url: faces[askIdx].url, alt: "Persona a identificar" },
    validate: (input) => {
      const ok = smartMatch(input, expected);
      return {
        correct: ok,
        expected,
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
  const noopValidate = (input: string) => ({
    correct: false,
    expected: "",
    userAnswer: input,
  });
  const scenarios: MultitaskScenario[] = [
    {
      id: crypto.randomUUID(),
      type: "multitask",
      prompt: "Leé una sola vez. Sin anotar. Respondé de memoria.",
      skill: "multitask",
      difficulty: 3,
      validate: noopValidate,
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
      validate: noopValidate,
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
      const ok = smartMatch(input, caso.correcta ? "Sí" : "No");
      return {
        correct: ok,
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

// ============ SÁBADO: COCINA APLICADA (memoria + tracking en contexto) ============
// Tres ejercicios temáticos:
//   1. genMenuStudy        → memorizar menú (progresivo fácil→difícil)
//   2. genCustomerOrders   → recordar quién pidió qué
//   3. genKitchenComanda   → tracking de comandas con eventos en secuencia

// ---- Datos base del menú (precios en ARS, contexto argentino) ----
type MenuItem = { name: string; price: number };
type MenuCategory = { category: string; items: MenuItem[] };

const MENU_CATEGORIES: MenuCategory[] = [
  {
    category: "Entradas",
    items: [
      { name: "Empanadas de carne", price: 3500 },
      { name: "Ensalada Caesar", price: 4200 },
      { name: "Sopa de calabaza", price: 3800 },
      { name: "Bruschetta", price: 3600 },
      { name: "Provoleta", price: 4500 },
      { name: "Rabas fritas", price: 6800 },
    ],
  },
  {
    category: "Principales",
    items: [
      { name: "Milanesa con fritas", price: 7800 },
      { name: "Pizza napolitana", price: 7200 },
      { name: "Ravioles de espinaca", price: 8500 },
      { name: "Bife de chorizo", price: 12500 },
      { name: "Pollo al horno", price: 8200 },
      { name: "Pastel de papa", price: 7900 },
      { name: "Sorrentinos", price: 8700 },
      { name: "Fileto de merluza", price: 9300 },
    ],
  },
  {
    category: "Postres",
    items: [
      { name: "Flan mixto", price: 3200 },
      { name: "Helado artesanal", price: 3500 },
      { name: "Tiramisú", price: 3800 },
      { name: "Panqueques con dulce", price: 3600 },
      { name: "Queso y dulce", price: 3000 },
      { name: "Mousse de chocolate", price: 3400 },
    ],
  },
  {
    category: "Bebidas",
    items: [
      { name: "Agua mineral", price: 1800 },
      { name: "Vino Malbec (copa)", price: 3500 },
      { name: "Limonada", price: 2500 },
      { name: "Cerveza artesanal", price: 4200 },
      { name: "Café espresso", price: 2200 },
      { name: "Soda", price: 2000 },
    ],
  },
];

// ---- 1. Memorización de menú ----
export interface MenuStudyExercise extends BaseExercise {
  type: "menu_study";
  menu: MenuCategory[];
  questions: { q: string; a: string }[];
  studyDurationMs: number;
}

// difficulty: 1=fácil (2 cat × 3 items=6), 2=medio (3 cat × 4=12), 3=difícil (4 cat × 5=20)
export function genMenuStudy(forceDifficulty?: 1 | 2 | 3): MenuStudyExercise {
  const difficulty = forceDifficulty ?? (pick([1, 2, 3]) as 1 | 2 | 3);
  const categoriesCount = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;
  const itemsPerCat = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5;
  const studySeconds = difficulty === 1 ? 12 : difficulty === 2 ? 20 : 32;

  // Selección aleatoria de categorías e ítems dentro de cada una
  const cats = [...MENU_CATEGORIES].sort(() => Math.random() - 0.5).slice(0, categoriesCount);
  const menu: MenuCategory[] = cats.map((c) => ({
    category: c.category,
    items: [...c.items].sort(() => Math.random() - 0.5).slice(0, itemsPerCat),
  }));

  // ---- Generación de preguntas ----
  const allQs: { q: string; a: string }[] = [];
  const flatItems = menu.flatMap((c) => c.items.map((it) => ({ ...it, category: c.category })));

  // Tipo A: precio de un ítem específico
  flatItems.slice(0, 4).forEach((it) => {
    allQs.push({
      q: `¿Cuál era el precio de "${it.name}"?`,
      a: formatARS(it.price),
    });
  });

  // Tipo B: ¿en qué categoría estaba X?
  flatItems.slice(0, 3).forEach((it) => {
    allQs.push({
      q: `¿En qué categoría estaba "${it.name}"?`,
      a: it.category,
    });
  });

  // Tipo C: ¿cuántos ítems hay en la categoría X?
  menu.forEach((c) => {
    allQs.push({
      q: `¿Cuántos ítems tenía la categoría "${c.category}"?`,
      a: String(c.items.length),
    });
  });

  // Tipo D: plato más caro/barato de una categoría
  menu.forEach((c) => {
    const sorted = [...c.items].sort((a, b) => b.price - a.price);
    allQs.push({
      q: `¿Cuál era el ítem MÁS CARO de "${c.category}"?`,
      a: sorted[0].name,
    });
    allQs.push({
      q: `¿Cuál era el ítem MÁS BARATO de "${c.category}"?`,
      a: sorted[sorted.length - 1].name,
    });
  });

  // Tipo E: ¿qué categoría tenía más ítems?
  const sortedCats = [...menu].sort((a, b) => b.items.length - a.items.length);
  allQs.push({
    q: `¿Qué categoría tenía MÁS ítems?`,
    a: sortedCats[0].category,
  });

  // Seleccionar 5 preguntas al azar, mezclando tipos
  const shuffled = [...allQs].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, 5);

  return {
    id: crypto.randomUUID(),
    type: "menu_study",
    prompt: "Estudiá el menú. Luego vas a tener que responder preguntas SIN volver a verlo.",
    skill: "retention",
    difficulty,
    menu,
    questions,
    studyDurationMs: studySeconds * 1000,
    validate: (input) => ({
      correct: false,
      expected: "",
      userAnswer: input,
    }),
  };
}

// ---- 2. Comensales: quién pidió qué ----
const CLIENTES_NOMBRES = [
  "María", "Juan", "Lucía", "Pedro", "Ana", "Carlos", "Sofía", "Diego",
  "Elena", "Pablo", "Carmen", "Mateo", "Valeria", "Tomás",
];

export interface CustomerOrdersExercise extends BaseExercise {
  type: "customer_orders";
  customers: { name: string; orders: string[] }[];
  questions: { q: string; a: string }[];
  studyDurationMs: number;
}

// difficulty: 1=3 clientes×1 plato, 2=4×2 platos, 3=5×(2-3) platos
export function genCustomerOrders(forceDifficulty?: 1 | 2 | 3): CustomerOrdersExercise {
  const difficulty = forceDifficulty ?? (pick([1, 2, 3]) as 1 | 2 | 3);
  const customersCount = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5;
  const ordersPerCustomer = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 0; // 0 = random 2-3
  const studySeconds = difficulty === 1 ? 8 : difficulty === 2 ? 14 : 22;

  // Pool de platos disponibles (sin bebidas para simplificar)
  const dishPool = [
    ...MENU_CATEGORIES[0].items.map((i) => i.name),
    ...MENU_CATEGORIES[1].items.map((i) => i.name),
    ...MENU_CATEGORIES[2].items.map((i) => i.name),
  ];

  // Seleccionar nombres únicos
  const names = [...CLIENTES_NOMBRES].sort(() => Math.random() - 0.5).slice(0, customersCount);

  // Asignar pedidos únicos por cliente (sin repetir plato dentro de su pedido)
  const customers = names.map((name) => {
    const n = ordersPerCustomer || rand(2, 3);
    const orders = [...dishPool].sort(() => Math.random() - 0.5).slice(0, n);
    return { name, orders };
  });

  // ---- Generar preguntas ----
  const allQs: { q: string; a: string }[] = [];

  // Tipo A: ¿qué pidió [Nombre]?
  customers.forEach((c) => {
    allQs.push({
      q: `¿Qué pidió ${c.name}?`,
      a: c.orders.join(", "),
    });
  });

  // Tipo B: ¿quién pidió [Plato]?
  customers.forEach((c) => {
    c.orders.forEach((dish) => {
      allQs.push({
        q: `¿Quién pidió ${dish}?`,
        a: c.name,
      });
    });
  });

  // Tipo C: ¿quién pidió más platos?
  const sorted = [...customers].sort((a, b) => b.orders.length - a.orders.length);
  allQs.push({
    q: `¿Quién pidió MÁS platos?`,
    a: sorted[0].name,
  });

  // Tipo D: ¿cuántos clientes pidieron postre?
  const postres = new Set(MENU_CATEGORIES[2].items.map((i) => i.name));
  const clientesConPostre = customers.filter((c) => c.orders.some((o) => postres.has(o)));
  if (clientesConPostre.length > 0) {
    allQs.push({
      q: `¿Cuántos clientes pidieron postre?`,
      a: String(clientesConPostre.length),
    });
  }

  // Seleccionar 4 preguntas
  const questions = [...allQs].sort(() => Math.random() - 0.5).slice(0, 4);

  return {
    id: crypto.randomUUID(),
    type: "customer_orders",
    prompt: "Memorizá quién pidió qué. Luego te pregunto.",
    skill: "retention",
    difficulty,
    customers,
    questions,
    studyDurationMs: studySeconds * 1000,
    validate: (input) => ({
      correct: false,
      expected: "",
      userAnswer: input,
    }),
  };
}

// ---- 3. Comanda de cocina: tracking con eventos ----
export interface KitchenComandaExercise extends BaseExercise {
  type: "kitchen_comanda";
  initialState: { table: number; courses: { course: string; dish: string; served: boolean }[] }[];
  events: { table: number; course: string; dish: string }[];
  questions: { q: string; a: string }[];
  studyDurationMs: number;    // tiempo para estudiar estado inicial
  eventsDurationMs: number;   // tiempo total para mostrar eventos en secuencia
}

const COURSES = [
  { course: "entrada", dishes: ["Empanadas", "Ensalada Caesar", "Sopa de calabaza", "Provoleta"] },
  { course: "principal", dishes: ["Milanesa", "Pizza napolitana", "Ravioles", "Bife de chorizo", "Pollo al horno"] },
  { course: "postre", dishes: ["Flan mixto", "Helado", "Tiramisú", "Panqueques con dulce"] },
];

// difficulty: 1=2 mesas×2 cursos, 3 eventos; 2=3×3, 6 eventos; 3=4×3, 9-10 eventos
export function genKitchenComanda(forceDifficulty?: 1 | 2 | 3): KitchenComandaExercise {
  const difficulty = forceDifficulty ?? (pick([1, 2, 3]) as 1 | 2 | 3);
  const tablesCount = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;
  const coursesPerTable = difficulty === 1 ? 2 : 3;
  const eventsCount = difficulty === 1 ? 3 : difficulty === 2 ? 6 : 10;
  const studySeconds = difficulty === 1 ? 10 : difficulty === 2 ? 16 : 24;
  const eventSecondsEach = difficulty === 1 ? 4 : difficulty === 2 ? 3.2 : 2.6;

  // Crear mesas con números realistas (30-80)
  const tableNumbers = Array.from({ length: 51 }, (_, i) => i + 30)
    .sort(() => Math.random() - 0.5)
    .slice(0, tablesCount);

  // Generar cursos para cada mesa
  const initialState = tableNumbers.map((table) => {
    const selectedCourses = [...COURSES].slice(0, coursesPerTable);
    const courses = selectedCourses.map((c) => {
      const dish = pick(c.dishes);
      return { course: c.course, dish, served: false };
    });
    return { table, courses };
  });

  // ---- Generar secuencia de eventos ----
  // Servir en orden (entrada → principal → postre) dejando algunas mesas incompletas
  const allPendingCourses = initialState.flatMap((t) =>
    t.courses.map((c) => ({ table: t.table, course: c.course, dish: c.dish }))
  );

  const courseOrder = ["entrada", "principal", "postre"];
  const sortedPending = [...allPendingCourses].sort((a, b) => {
    if (a.table !== b.table) return a.table - b.table;
    return courseOrder.indexOf(a.course) - courseOrder.indexOf(b.course);
  });

  const events: { table: number; course: string; dish: string }[] = [];
  for (let i = 0; i < Math.min(eventsCount, sortedPending.length); i++) {
    events.push(sortedPending[i]);
  }

  // Calcular estado final
  const finalState = initialState.map((t) => ({
    ...t,
    courses: t.courses.map((c) => {
      const wasServed = events.some(
        (e) => e.table === t.table && e.course === c.course && e.dish === c.dish
      );
      return { ...c, served: wasServed };
    }),
  }));

  // ---- Generar preguntas sobre el estado final ----
  const allQs: { q: string; a: string }[] = [];

  // Tipo A: ¿qué falta en la mesa X? / ¿está completa?
  finalState.forEach((t) => {
    const pending = t.courses.filter((c) => !c.served);
    if (pending.length > 0) {
      allQs.push({
        q: `¿Qué falta en la mesa ${t.table}?`,
        a: pending.map((p) => `${p.course} (${p.dish})`).join(" + "),
      });
    } else {
      allQs.push({
        q: `¿La comanda de la mesa ${t.table} está completa?`,
        a: "Sí, completa",
      });
    }
  });

  // Tipo B: ¿cuántas mesas están completas?
  const completas = finalState.filter((t) => t.courses.every((c) => c.served));
  allQs.push({
    q: `¿Cuántas mesas tienen la comanda COMPLETA?`,
    a: String(completas.length),
  });

  // Tipo C: ¿qué mesa está incompleta?
  const incompletas = finalState.filter((t) => !t.courses.every((c) => c.served));
  if (incompletas.length > 0) {
    allQs.push({
      q: `¿Qué mesa está INCOMPLETA?`,
      a: incompletas.map((t) => String(t.table)).join(", "),
    });
  }

  // Tipo D: ¿cuál fue el último plato que salió?
  if (events.length > 0) {
    const last = events[events.length - 1];
    allQs.push({
      q: `¿Cuál fue el ÚLTIMO plato que salió?`,
      a: `${last.dish} (mesa ${last.table})`,
    });
  }

  // Tipo E: ¿cuántos platos salieron en total?
  allQs.push({
    q: `¿Cuántos platos salieron en total?`,
    a: String(events.length),
  });

  // Seleccionar 4-5 preguntas
  const questionCount = difficulty === 1 ? 4 : 5;
  const questions = [...allQs].sort(() => Math.random() - 0.5).slice(0, questionCount);

  return {
    id: crypto.randomUUID(),
    type: "kitchen_comanda",
    prompt: "Vas a ver el estado inicial, luego una secuencia de platos que salen. Al final respondés.",
    skill: "multitask",
    difficulty,
    initialState,
    events,
    questions,
    studyDurationMs: studySeconds * 1000,
    eventsDurationMs: Math.round(events.length * eventSecondsEach * 1000),
    validate: (input) => ({
      correct: false,
      expected: "",
      userAnswer: input,
    }),
  };
}

// ============ SESIONES POR DÍA ============

export interface SessionPlan {
  day: "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";
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
    subtitle: "Suma mental + cadenas + N-back + nombres",
    focus: "Romper el cuello de botella del buffer de 2 elementos + memoria a corto plazo",
    durationMin: 10,
    exercises: () => [
      genSum3Digits(), genSum3Digits(), genSum3Digits(),
      genOpChain(), genOpChain(), genOpChain(),
      genNBack(), genNBack(), genNBack(),
      genNames(), genNames(),
    ],
  },
  martes: {
    day: "martes",
    title: "Cálculo cotidiano",
    subtitle: "Vueltos + % invertido + fracciones + multiplicación",
    focus: "PUNTO CRÍTICO: porcentaje invertido y fracciones. No te saltes este día.",
    durationMin: 10,
    exercises: () => [
      genVuelto(), genVuelto(), genVuelto(),
      genPctInvertido(), genPctInvertido(), genPctInvertido(), genPctInvertido(),
      genFraction(), genFraction(), genFraction(), genFraction(),
      genMult2(), genMult2(),
    ],
  },
  miercoles: {
    day: "miercoles",
    title: "Retención bajo fricción",
    subtitle: "Lectura densa + memoria de rostros y nombres",
    focus: "Una sola pasada. Sin anotar. Sin volver arriba. Incluye rostros.",
    durationMin: 10,
    exercises: () => [
      genRetention(),
      genFaces(), genFaces(),
      genNames(), genNames(),
    ],
  },
  jueves: {
    day: "jueves",
    title: "Multitarea y fronteras",
    subtitle: "Escenarios complejos + semántica fina + memoria visual",
    focus: "Fronteras (antes de / hasta / desde) + memoria de rostros bajo carga.",
    durationMin: 10,
    exercises: () => [
      genMultitask(),
      genBoundary(), genBoundary(), genBoundary(), genBoundary(),
      genFaces(), genNBack(),
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
  sabado: {
    day: "sabado",
    title: "Cocina aplicada",
    subtitle: "Menú + comensales + comandas en cocina",
    focus: "Memoria semántica + working memory bajo presión. Progresión fácil→difícil en cada bloque.",
    durationMin: 12,
    exercises: () => [
      // Bloque 1: menú (progresivo)
      genMenuStudy(1),
      genMenuStudy(2),
      genMenuStudy(3),
      // Bloque 2: comensales (progresivo)
      genCustomerOrders(1),
      genCustomerOrders(2),
      genCustomerOrders(3),
      // Bloque 3: comandas de cocina (progresivo)
      genKitchenComanda(1),
      genKitchenComanda(2),
      genKitchenComanda(3),
    ],
  },
};

export const DAY_ORDER: SessionPlan["day"][] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

// Dado un Date, devuelve el día de la sesión correspondiente
export function getTodaySession(): SessionPlan["day"] {
  const dayIdx = (new Date().getDay() + 6) % 7; // lunes=0, domingo=6
  if (dayIdx === 5) return "sabado"; // sábado → cocina aplicada
  if (dayIdx === 6) return "lunes";  // domingo → lunes
  return DAY_ORDER[dayIdx];
}

// ============ MODO LIBRE ============
// Catálogo de tipos de ejercicios. El usuario puede elegir tipo + nivel +
// cantidad y entrenar lo que quiera sin seguir la rotación semanal.

export interface ExerciseCatalogEntry {
  type: string;
  label: string;
  category: string;
  description: string;
  supportsDifficulty: boolean;
  supportsItemsCount: boolean;
  itemsCountLabel: string;       // ej: "rostros", "nombres", "dígitos"
  itemsCountMin: number;
  itemsCountMax: number;
  itemsCountDefault: number;
  skill: BaseExercise["skill"];
  generate: (difficulty?: 1 | 2 | 3, opts?: { itemsCount?: number }) => BaseExercise;
}

export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // --- Memoria / Buffer ---
  {
    type: "sum3",
    label: "Suma mental de 3 dígitos",
    category: "Memoria / Buffer",
    description: "Sumá tres números de tres cifras en una sola pasada.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "buffer",
    generate: () => genSum3Digits(),
  },
  {
    type: "chain",
    label: "Cadena de operaciones",
    category: "Memoria / Buffer",
    description: "5 operaciones encadenadas (con divisiones exactas).",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "buffer",
    generate: () => genOpChain(),
  },
  {
    type: "nback",
    label: "N-back visual",
    category: "Memoria / Buffer",
    description: "Secuencia de números que desaparece. Hay que recordar posiciones.",
    supportsDifficulty: false,
    supportsItemsCount: true,
    itemsCountLabel: "dígitos",
    itemsCountMin: 4,
    itemsCountMax: 12,
    itemsCountDefault: 7,
    skill: "buffer",
    generate: (_d, opts) => genNBack(opts),
  },
  {
    type: "names",
    label: "Memoria de nombres",
    category: "Memoria / Buffer",
    description: "Lista de nombres que se oculta. Preguntas de posición / antes / después.",
    supportsDifficulty: false,
    supportsItemsCount: true,
    itemsCountLabel: "nombres",
    itemsCountMin: 3,
    itemsCountMax: 10,
    itemsCountDefault: 5,
    skill: "retention",
    generate: (_d, opts) => genNames(opts),
  },
  {
    type: "faces",
    label: "Memoria de rostros",
    category: "Memoria / Buffer",
    description: "Memorizá rostros con nombres. Después ves una foto y decís quién es.",
    supportsDifficulty: false,
    supportsItemsCount: true,
    itemsCountLabel: "rostros",
    itemsCountMin: 2,
    itemsCountMax: 8,
    itemsCountDefault: 4,
    skill: "retention",
    generate: (_d, opts) => genFaces(opts),
  },
  // --- Cálculo cotidiano ---
  {
    type: "vuelto",
    label: "Vueltos con descuento",
    category: "Cálculo",
    description: "Precio con descuento + billete grande. Calcular vuelto en ARS.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "calc",
    generate: () => genVuelto(),
  },
  {
    type: "pct_inv",
    label: "Porcentaje invertido",
    category: "Cálculo",
    description: "Te doy el precio con descuento. Vos decís el precio ORIGINAL.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "calc",
    generate: () => genPctInvertido(),
  },
  {
    type: "mult2",
    label: "Multiplicación 2 dígitos",
    category: "Cálculo",
    description: "Multiplicación mental de dos números de 2 cifras.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "calc",
    generate: () => genMult2(),
  },
  {
    type: "fraction",
    label: "Operaciones con fracciones",
    category: "Cálculo",
    description: "Suma, resta o multiplicación de fracciones. Resultado simplificado.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "calc",
    generate: () => genFraction(),
  },
  // --- Cocina aplicada ---
  {
    type: "menu_study",
    label: "Memorizar menú",
    category: "Cocina aplicada",
    description: "Estudiá un menú (precio, categoría, más caro/barato) y respondés.",
    supportsDifficulty: true,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "retention",
    generate: (d) => genMenuStudy(d),
  },
  {
    type: "customer_orders",
    label: "Comensales: quién pidió qué",
    category: "Cocina aplicada",
    description: "Memorizá qué pidió cada comensal. Después te pregunto.",
    supportsDifficulty: true,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "retention",
    generate: (d) => genCustomerOrders(d),
  },
  {
    type: "kitchen_comanda",
    label: "Comanda de cocina",
    category: "Cocina aplicada",
    description: "Ves mesas con cursos pendientes. Cantás los SALE. Respondés qué falta.",
    supportsDifficulty: true,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "multitask",
    generate: (d) => genKitchenComanda(d),
  },
  // --- Lectura densa ---
  {
    type: "retention",
    label: "Texto de retención",
    category: "Lectura densa",
    description: "Texto de negocio. Una sola lectura. 6 preguntas de memoria.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "retention",
    generate: () => genRetention(),
  },
  {
    type: "multitask",
    label: "Escenario multitarea",
    category: "Lectura densa",
    description: "Coordinación de mesas / remises. Múltiples preguntas en bloque.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "multitask",
    generate: () => genMultitask(),
  },
  {
    type: "boundary",
    label: "Fronteras semánticas",
    category: "Lectura densa",
    description: "¿Aplica antes de / hasta / desde? Sí o No.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "semantic",
    generate: () => genBoundary(),
  },
  // --- Velocidad ---
  {
    type: "speed",
    label: "Velocidad pura",
    category: "Velocidad",
    description: "+, ×, % y vueltos simples. Rápido, no perfecto.",
    supportsDifficulty: false,
    supportsItemsCount: false,
    itemsCountLabel: "",
    itemsCountMin: 0,
    itemsCountMax: 0,
    itemsCountDefault: 0,
    skill: "speed",
    generate: () => genSpeedExercise(),
  },
];

// Generar N ejercicios de un tipo y dificultad dados
export function generateCustomSet(
  type: string,
  difficulty: 1 | 2 | 3 | null,
  count: number,
  itemsCount?: number
): BaseExercise[] {
  const entry = EXERCISE_CATALOG.find((e) => e.type === type);
  if (!entry) return [];
  const d = entry.supportsDifficulty && difficulty ? difficulty : undefined;
  const opts = entry.supportsItemsCount && itemsCount ? { itemsCount } : undefined;
  return Array.from({ length: count }, () => entry.generate(d, opts));
}

