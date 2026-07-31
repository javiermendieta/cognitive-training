// Smoke test para smartMatch
// Verifica que las respuestas correctas se validen como correctas
// y que las incorrectas se rechacen.

import { smartMatch, normalizeText, extractNumbers } from "../src/lib/cognitive-engine";

interface Case {
  user: string;
  expected: string;
  shouldMatch: boolean;
  label: string;
}

const cases: Case[] = [
  // --- Acentos ---
  { user: "María", expected: "María", shouldMatch: true, label: "igual exacto" },
  { user: "Maria", expected: "María", shouldMatch: true, label: "sin tilde" },
  { user: "maria", expected: "María", shouldMatch: true, label: "minúsculas sin tilde" },
  { user: "MARIA", expected: "María", shouldMatch: true, label: "mayúsculas sin tilde" },
  { user: "Marta", expected: "María", shouldMatch: false, label: "nombre distinto" },
  { user: "Lucía", expected: "Lucía", shouldMatch: true, label: "con tilde igual" },
  { user: "lucia", expected: "Lucía", shouldMatch: true, label: "sin tilde igual" },
  { user: "sofía", expected: "Sofía", shouldMatch: true, label: "min con tilde" },
  { user: "sofia", expected: "Sofía", shouldMatch: true, label: "min sin tilde" },

  // --- Nombres con parcial ---
  { user: "empanada", expected: "Empanadas de carne", shouldMatch: true, label: "substring de nombre" },
  { user: "empanadas", expected: "Empanadas de carne", shouldMatch: true, label: "plural substring" },
  { user: "milanesa", expected: "Milanesa con fritas", shouldMatch: true, label: "substring" },
  { user: "fritas", expected: "Milanesa con fritas", shouldMatch: true, label: "substring al final" },
  { user: "pollo", expected: "Pollo al horno", shouldMatch: true, label: "primer palabra" },
  { user: "pizza", expected: "Pizza napolitana", shouldMatch: true, label: "pizza" },
  { user: "caesar", expected: "Ensalada Caesar", shouldMatch: true, label: "caesar sin tilde" },
  { user: "caésar", expected: "Caesar", shouldMatch: true, label: "tilde rara" },
  { user: "flan", expected: "Flan mixto", shouldMatch: true, label: "flan" },
  { user: "tiramisu", expected: "Tiramisú", shouldMatch: true, label: "sin tilde" },
  { user: "tiramisú", expected: "Tiramisú", shouldMatch: true, label: "con tilde" },

  // --- Números (precios) ---
  { user: "3500", expected: "$3.500", shouldMatch: true, label: "precio sin $" },
  { user: "$3500", expected: "$3.500", shouldMatch: true, label: "precio con $" },
  { user: "3.500", expected: "$3.500", shouldMatch: true, label: "precio con punto miles" },
  { user: "3500 pesos", expected: "$3.500", shouldMatch: true, label: "con palabra pesos" },
  { user: "3501", expected: "$3.500", shouldMatch: false, label: "precio diferente" },
  { user: "4000", expected: "$3.500", shouldMatch: false, label: "otro precio" },

  // --- Números con sufijo de magnitud ---
  { user: "42,3 millones", expected: "$42,3 millones", shouldMatch: true, label: "millones" },
  { user: "$42,3 millones", expected: "$42,3 millones", shouldMatch: true, label: "millones con $" },
  { user: "42300000", expected: "$42,3 millones", shouldMatch: true, label: "millones en número" },
  { user: "42.300.000", expected: "$42,3 millones", shouldMatch: true, label: "millones en número AR" },
  { user: "42 millones", expected: "$42,3 millones", shouldMatch: false, label: "millones diferente" },
  { user: "10 millones", expected: "$42,3 millones", shouldMatch: false, label: "otra magnitud" },

  // --- Categorías ---
  { user: "Entradas", expected: "Entradas", shouldMatch: true, label: "categoría igual" },
  { user: "entrada", expected: "Entradas", shouldMatch: true, label: "singular" },
  { user: "postre", expected: "Postres", shouldMatch: true, label: "singular postre" },
  { user: "bebida", expected: "Bebidas", shouldMatch: true, label: "singular bebida" },
  { user: "principales", expected: "Principales", shouldMatch: true, label: "principales" },
  { user: "principal", expected: "Principales", shouldMatch: true, label: "principal singular" },

  // --- Sí/No ---
  { user: "sí", expected: "Sí, completa", shouldMatch: true, label: "sí" },
  { user: "si", expected: "Sí, completa", shouldMatch: true, label: "si sin tilde" },
  { user: "SÍ", expected: "Sí, completa", shouldMatch: true, label: "mayúscula" },
  { user: "completa", expected: "Sí, completa", shouldMatch: true, label: "completa" },
  { user: "completo", expected: "Sí, completa", shouldMatch: true, label: "completo" },
  { user: "no", expected: "Sí, completa", shouldMatch: false, label: "no cuando sí" },
  { user: "falta", expected: "Sí, completa", shouldMatch: false, label: "falta cuando sí" },
  { user: "incompleta", expected: "Sí, completa", shouldMatch: false, label: "incompleta cuando sí" },
  { user: "no", expected: "No, falta entrada", shouldMatch: true, label: "no" },
  { user: "falta", expected: "No, falta entrada", shouldMatch: true, label: "falta" },
  { user: "incompleta", expected: "No, falta entrada", shouldMatch: true, label: "incompleta cuando no" },
  { user: "sí", expected: "No, falta entrada", shouldMatch: false, label: "sí cuando no" },
  { user: "completa", expected: "No, falta entrada", shouldMatch: false, label: "completa cuando no" },

  // --- Listas ---
  { user: "Milanesa, Helado", expected: "Milanesa con fritas, Helado artesanal", shouldMatch: true, label: "lista ambos" },
  { user: "milanesa y helado", expected: "Milanesa con fritas, Helado artesanal", shouldMatch: true, label: "lista con y" },
  { user: "milanesa + helado", expected: "Milanesa con fritas, Helado artesanal", shouldMatch: true, label: "lista con +" },
  { user: "milanesa", expected: "Milanesa con fritas, Helado artesanal", shouldMatch: false, label: "lista falta uno" },
  { user: "helado", expected: "Milanesa con fritas, Helado artesanal", shouldMatch: false, label: "lista falta el otro" },

  // --- Listas de comandas ---
  { user: "entrada Empanadas + principal Milanesa", expected: "entrada (Empanadas) + principal (Milanesa)", shouldMatch: true, label: "comanda lista ambos" },
  { user: "entrada empanadas", expected: "entrada (Empanadas) + principal (Milanesa)", shouldMatch: false, label: "comanda falta uno" },

  // --- Mesas (números sueltos) ---
  { user: "35", expected: "35", shouldMatch: true, label: "mesa igual" },
  { user: "35 y 40", expected: "35, 40", shouldMatch: true, label: "mesas múltiples" },
  { user: "35, 40", expected: "35, 40", shouldMatch: true, label: "mesas múltiples coma" },
  { user: "35 + 40", expected: "35, 40", shouldMatch: true, label: "mesas múltiples +" },
  { user: "35", expected: "35, 40", shouldMatch: false, label: "mesas falta una" },
  { user: "35 y 41", expected: "35, 40", shouldMatch: false, label: "mesas una mal" },

  // --- Cantidad ---
  { user: "3", expected: "3", shouldMatch: true, label: "cantidad igual" },
  { user: "4", expected: "3", shouldMatch: false, label: "cantidad diferente" },

  // --- Texto con números ---
  { user: "Milanesa (mesa 35)", expected: "Milanesa (mesa 35)", shouldMatch: true, label: "plato + mesa igual" },
  { user: "milanesa mesa 35", expected: "Milanesa (mesa 35)", shouldMatch: true, label: "sin paréntesis" },
  { user: "Milanesa", expected: "Milanesa (mesa 35)", shouldMatch: true, label: "sólo el plato" },
  { user: "Pollo mesa 35", expected: "Milanesa (mesa 35)", shouldMatch: false, label: "plato distinto mismo mesa" },
  { user: "Milanesa mesa 40", expected: "Milanesa (mesa 35)", shouldMatch: false, label: "plato igual mesa distinta" },

  // --- Casos adicionales de robustez ---
  { user: "Empanada de carne", expected: "Empanadas de carne", shouldMatch: true, label: "singular vs plural" },
  { user: "empanadas de carne", expected: "Empanadas de carne", shouldMatch: true, label: "minúsculas" },
  { user: "  milanesa  ", expected: "Milanesa", shouldMatch: true, label: "espacios extra" },
  { user: "Bife de chorizo", expected: "Bife de chorizo", shouldMatch: true, label: "bife exacto" },
  { user: "bife", expected: "Bife de chorizo", shouldMatch: true, label: "bife substring" },
  { user: "chorizo", expected: "Bife de chorizo", shouldMatch: true, label: "chorizo substring" },
  { user: "lomo", expected: "Bife de chorizo", shouldMatch: false, label: "carne distinta" },
  { user: "Ravioles de espinaca", expected: "Ravioles de espinaca", shouldMatch: true, label: "ravioles" },
  { user: "ravioles", expected: "Ravioles de espinaca", shouldMatch: true, label: "ravioles corto" },
  { user: "sorrentinos", expected: "Sorrentinos", shouldMatch: true, label: "sorrentinos" },
  { user: "Sopa de calabaza", expected: "Sopa de calabaza", shouldMatch: true, label: "sopa" },
  { user: "sopa", expected: "Sopa de calabaza", shouldMatch: true, label: "sopa corto" },
  { user: "Panqueques con dulce", expected: "Panqueques con dulce", shouldMatch: true, label: "panqueques" },
  { user: "Panqueques", expected: "Panqueques con dulce", shouldMatch: true, label: "panqueques corto" },
  { user: "Queso y dulce", expected: "Queso y dulce", shouldMatch: true, label: "queso y dulce" },

  // --- Cantidades en comanda ---
  { user: "2", expected: "2", shouldMatch: true, label: "cantidad 2" },
  { user: "1", expected: "1", shouldMatch: true, label: "cantidad 1" },
  { user: "0", expected: "0", shouldMatch: true, label: "cantidad 0" },
  { user: "1", expected: "2", shouldMatch: false, label: "cantidad diferente" },

  // --- Frases con puntuación ---
  { user: "después del 6to pedido", expected: "Después del 6to pedido (es decir, después de los 2 próximos)", shouldMatch: true, label: "frase con paréntesis" },
  { user: "despues del 6to pedido", expected: "Después del 6to pedido", shouldMatch: true, label: "sin tilde" },
  { user: "El B (vuelve 8:45)", expected: "El B (vuelve 8:45) o el D (vuelve 9:10), pero no el A (vuelve 8:45 también)", shouldMatch: false, label: "respuesta parcial a lista larga" },

  // --- Sí/No con variantes ---
  { user: "aplica", expected: "Sí", shouldMatch: true, label: "aplica = sí" },
  { user: "no aplica", expected: "Sí", shouldMatch: false, label: "no aplica ≠ sí" },
  { user: "verdadero", expected: "Sí", shouldMatch: true, label: "verdadero = sí" },
  { user: "falso", expected: "Sí", shouldMatch: false, label: "falso ≠ sí" },
  { user: "falso", expected: "No", shouldMatch: true, label: "falso = no" },
  { user: "verdadero", expected: "No", shouldMatch: false, label: "verdadero ≠ no" },
];

let passed = 0;
let failed = 0;
const failures: Case[] = [];

for (const c of cases) {
  const got = smartMatch(c.user, c.expected);
  if (got === c.shouldMatch) {
    passed++;
  } else {
    failed++;
    failures.push({ ...c, label: `${c.label} | got=${got} expected=${c.shouldMatch}` });
  }
}

console.log(`\n${passed}/${cases.length} pasaron, ${failed} fallaron\n`);
if (failures.length > 0) {
  console.log("FALLAS:");
  for (const f of failures) {
    console.log(`  X ${f.label}`);
    console.log(`    user="${f.user}" expected="${f.expected}" shouldMatch=${f.shouldMatch}`);
  }
  process.exit(1);
}

// Tests extra para extractNumbers
console.log("\n--- extractNumbers ---");
const numTests: { input: string; expected: number[] }[] = [
  { input: "$3.500", expected: [3500] },
  { input: "$42,3 millones", expected: [42300000] },
  { input: "42300000", expected: [42300000] },
  { input: "10", expected: [10] },
  { input: "35, 40", expected: [35, 40] },
  { input: "$8.000", expected: [8000] },
  { input: "350.000", expected: [350000] },
  { input: "1.5 millones", expected: [1500000] },
];
for (const t of numTests) {
  const got = extractNumbers(t.input);
  const ok = JSON.stringify(got) === JSON.stringify(t.expected);
  console.log(`${ok ? "OK" : "FAIL"} extractNumbers("${t.input}") = [${got.join(", ")}] (esperado [${t.expected.join(", ")}])`);
  if (!ok) process.exitCode = 1;
}

console.log("\n--- normalizeText ---");
const normTests: { input: string; expected: string }[] = [
  { input: "María", expected: "maria" },
  { input: "  $42,3  millones  ", expected: "42 3 millones" },
  { input: "Sí, completa", expected: "si completa" },
];
for (const t of normTests) {
  const got = normalizeText(t.input);
  const ok = got === t.expected;
  console.log(`${ok ? "OK" : "FAIL"} normalizeText("${t.input}") = "${got}" (esperado "${t.expected}")`);
  if (!ok) process.exitCode = 1;
}

console.log("\nOK");
