"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Check, X, Clock, ArrowRight, AlertTriangle, Eye, EyeOff, ChefHat } from "lucide-react";
import type {
  BaseExercise,
  RetentionExercise,
  MultitaskScenario,
  MenuStudyExercise,
  CustomerOrdersExercise,
  KitchenComandaExercise,
} from "@/lib/cognitive-engine";
import { smartMatch } from "@/lib/cognitive-engine";

// Tipos de ejercicio cuya respuesta es numérica (teclado numérico en móvil).
// Todo lo demás (nombres, rostros, retention, multitask, boundary, menu, comanda,
// fracciones con texto) usa teclado de texto completo para poder escribir letras.
const NUMERIC_TYPES = new Set([
  "sum3",
  "chain",
  "nback",
  "vuelto",
  "pct_inv",
  "mult2",
  "speed",
]);

interface Props {
  exercise: BaseExercise;
  index: number;
  total: number;
  onAnswer: (correct: boolean, timeMs: number, userAnswer: string) => void;
  onNext: () => void;
  isLast: boolean;
}

export function ExerciseRunner({ exercise, index, total, onAnswer, onNext, isLast }: Props) {
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string } | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Fase "display" para ejercicios con timer (n-back, names, faces)
  // El ejercicio muestra contenido X segundos, lo oculta, y luego recién
  // arranca el cronómetro y muestra el prompt + input.
  const hasTimedDisplay = Boolean(exercise.timedDisplay || exercise.timedImages);
  const [phase, setPhase] = useState<"display" | "answer">(
    hasTimedDisplay ? "display" : "answer"
  );
  const totalDisplayMs =
    exercise.timedDisplay?.durationMs ?? exercise.timedDurationMs ?? 0;
  const [timeLeft, setTimeLeft] = useState(totalDisplayMs);

  // Reset al cambiar de ejercicio
  useEffect(() => {
    setInput("");
    setRevealed(false);
    setFeedback(null);
    if (hasTimedDisplay) {
      setPhase("display");
      setTimeLeft(totalDisplayMs);
      // No arrancar el cronómetro todavía — arranca cuando termina el display
    } else {
      setPhase("answer");
      startTimeRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // Countdown del display
  useEffect(() => {
    if (phase !== "display") return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, totalDisplayMs - elapsed);
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(interval);
        setPhase("answer");
        startTimeRef.current = Date.now(); // Arrancar cronómetro de respuesta ahora
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exercise.id]);

  // Permitir saltear el display si el usuario ya memorizó
  const skipDisplay = () => {
    setPhase("answer");
    startTimeRef.current = Date.now();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (revealed) return;
    const timeMs = Date.now() - startTimeRef.current;
    const result = exercise.validate(input);
    setFeedback({ correct: result.correct, expected: result.expected });
    setRevealed(true);
    onAnswer(result.correct, timeMs, input);
  };

  const handleSkip = () => {
    if (revealed) return;
    const timeMs = Date.now() - startTimeRef.current;
    setFeedback({ correct: false, expected: "—skipped—" });
    setRevealed(true);
    onAnswer(false, timeMs, "[skip]");
  };

  // ============ FASE DISPLAY (mostrar contenido con countdown) ============
  if (phase === "display") {
    const seconds = Math.ceil(timeLeft / 1000);
    return (
      <Card className="p-6 md:p-8 border-amber-500/40 dark:bg-zinc-900 bg-amber-50">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Memorizá esto
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" />
            desaparece en {seconds}s
          </span>
        </div>

        {exercise.timedDisplay && (
          <div className="text-4xl md:text-6xl font-mono font-bold text-center py-10 tracking-wider whitespace-pre-wrap leading-relaxed">
            {exercise.timedDisplay.content}
          </div>
        )}

        {exercise.timedImages && (
          <div className={`grid gap-4 py-4 ${exercise.timedImages.length <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
            {exercise.timedImages.map((img, i) => (
              <div key={i} className="text-center">
                <img
                  src={img.url}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg mb-2 bg-muted"
                  loading="eager"
                />
                <div className="font-mono text-base md:text-lg font-semibold">
                  {i + 1}. {img.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-1.5 bg-muted rounded overflow-hidden mt-6">
          <div
            className="h-full bg-amber-500 transition-all duration-100"
            style={{ width: `${totalDisplayMs > 0 ? (timeLeft / totalDisplayMs) * 100 : 0}%` }}
          />
        </div>

        <Button
          onClick={skipDisplay}
          variant="ghost"
          size="sm"
          className="w-full mt-4 text-xs"
        >
          Ya memoricé, pasar a la pregunta
        </Button>
      </Card>
    );
  }

  // ============ FASE ANSWER (prompt + input) ============
  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Ejercicio {index + 1} / {total}</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          cronometrando
        </span>
      </div>

      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {exercise.skill} · nivel {exercise.difficulty}
      </div>

      {hasTimedDisplay && !exercise.answerImage && (
        <div className="mb-3 text-xs text-amber-400 flex items-center gap-1 font-mono uppercase tracking-wider">
          <EyeOff className="w-3 h-3" />
          contenido oculto
        </div>
      )}

      {exercise.answerImage && (
        <div className="flex justify-center mb-6">
          <img
            src={exercise.answerImage.url}
            alt={exercise.answerImage.alt || ""}
            className="w-40 h-40 md:w-48 md:h-48 object-cover rounded-lg border border-border/60 bg-muted"
            loading="eager"
          />
        </div>
      )}

      <div className="text-lg md:text-2xl font-medium whitespace-pre-wrap leading-relaxed mb-6">
        {exercise.prompt}
      </div>

      {!revealed ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <Input
            autoFocus
            type="text"
            inputMode={NUMERIC_TYPES.has(exercise.type) ? "numeric" : "text"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tu respuesta"
            className="text-lg h-12"
          />
          <Button type="submit" size="lg" disabled={!input.trim()} className="h-12 px-6">
            Enviar
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={handleSkip} className="h-12">
            No sé
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${feedback?.correct ? "border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "border-red-500/40 dark:bg-red-950/50 bg-red-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              {feedback?.correct ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <X className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-medium ${feedback?.correct ? "text-emerald-300" : "text-red-300"}`}>
                {feedback?.correct ? "Correcto" : "Incorrecto"}
              </span>
            </div>
            {!feedback?.correct && (
              <div className="text-sm">
                <div className="text-muted-foreground">Tu respuesta: <span className="font-mono">{feedback?.expected === "—skipped—" ? "—" : input || "—"}</span></div>
                <div className="text-muted-foreground">Respuesta correcta: <span className="font-mono text-foreground">{feedback?.expected}</span></div>
              </div>
            )}
          </div>

          <Button onClick={onNext} size="lg" className="w-full h-12">
            {isLast ? "Finalizar sesión" : "Siguiente"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </Card>
  );
}

// ============ COMPONENTE PARA RETENCIÓN ============

export function RetentionRunner({ exercise, onDone }: {
  exercise: RetentionExercise;
  onDone: (results: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => void;
}) {
  const [phase, setPhase] = useState<"reading" | "questions">("reading");
  const [answers, setAnswers] = useState<string[]>(() => exercise.questions.map(() => ""));
  const [revealed, setRevealed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const startQuestions = () => {
    startTimeRef.current = Date.now();
    setPhase("questions");
  };

  const check = (ans: string, expected: string): boolean => smartMatch(ans, expected);

  const finish = () => {
    setRevealed(true);
  };

  if (phase === "reading") {
    return (
      <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span>Fase 1: Lectura</span>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            una sola pasada
          </span>
        </div>

        <div className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-wrap">
          {exercise.text}
        </div>

        <Button onClick={startQuestions} size="lg" className="w-full h-12">
          Ya leí. Pasar a las preguntas
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Fase 2: Preguntas</span>
        <span>El texto ya NO está visible</span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "p-3 rounded border border-red-500/40 dark:bg-red-950/50 bg-red-50"
            ) : "p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
                  type="text"
                  inputMode="text"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Respuesta"
                  className="h-10"
                />
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <Button onClick={finish} size="lg" className="w-full h-12">
          Finalizar y ver resultados
        </Button>
      ) : (
        <Button
          onClick={() => onDone(
            exercise.questions.map((q, i) => ({
              q: q.q,
              userAnswer: answers[i],
              correct: check(answers[i], q.a),
              expected: q.a,
            })),
            Date.now() - startTimeRef.current
          )}
          size="lg"
          className="w-full h-12"
        >
          Continuar
        </Button>
      )}
    </Card>
  );
}

// ============ COMPONENTE PARA MULTITAREA ============

export function MultitaskRunner({ exercise, onDone }: {
  exercise: MultitaskScenario;
  onDone: (results: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => void;
}) {
  const [phase, setPhase] = useState<"reading" | "questions">("reading");
  const [answers, setAnswers] = useState<string[]>(() => exercise.questions.map(() => ""));
  const [revealed, setRevealed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const startQuestions = () => {
    startTimeRef.current = Date.now();
    setPhase("questions");
  };

  const check = (ans: string, expected: string): boolean => smartMatch(ans, expected);

  const finish = () => {
    setRevealed(true);
  };

  if (phase === "reading") {
    return (
      <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span>Escenario (una sola lectura)</span>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            sin anotar
          </span>
        </div>

        <div className="text-base md:text-lg leading-relaxed mb-6 whitespace-pre-wrap">
          {exercise.scenario}
        </div>

        <Button onClick={startQuestions} size="lg" className="w-full h-12">
          Ya leí. Pasar a las preguntas
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Preguntas</span>
        <span>El escenario ya NO está visible</span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "p-3 rounded border border-red-500/40 dark:bg-red-950/50 bg-red-50"
            ) : "p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
                  type="text"
                  inputMode="text"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Respuesta"
                  className="h-10"
                />
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <Button onClick={finish} size="lg" className="w-full h-12">
          Finalizar y ver resultados
        </Button>
      ) : (
        <Button
          onClick={() => onDone(
            exercise.questions.map((q, i) => ({
              q: q.q,
              userAnswer: answers[i],
              correct: check(answers[i], q.a),
              expected: q.a,
            })),
            Date.now() - startTimeRef.current
          )}
          size="lg"
          className="w-full h-12"
        >
          Continuar
        </Button>
      )}
    </Card>
  );
}


// ============ COMPONENTE PARA MEMORIZACIÓN DE MENÚ ============

export function MenuStudyRunner({ exercise, onDone }: {
  exercise: MenuStudyExercise;
  onDone: (results: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => void;
}) {
  const [phase, setPhase] = useState<"study" | "questions">("study");
  const [timeLeft, setTimeLeft] = useState(exercise.studyDurationMs);
  const [answers, setAnswers] = useState<string[]>(() => exercise.questions.map(() => ""));
  const [revealed, setRevealed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase !== "study") return;
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, exercise.studyDurationMs - (Date.now() - start));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(interval);
        startQuestions();
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exercise.id]);

  const startQuestions = () => {
    startTimeRef.current = Date.now();
    setPhase("questions");
  };

  const check = (ans: string, expected: string): boolean => smartMatch(ans, expected);

  if (phase === "study") {
    const seconds = Math.ceil(timeLeft / 1000);
    return (
      <Card className="p-6 md:p-8 border-amber-500/40 dark:bg-zinc-900 bg-amber-50">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <ChefHat className="w-3 h-3" />
            Estudiá el menú · nivel {exercise.difficulty}
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" />
            desaparece en {seconds}s
          </span>
        </div>

        <div className="space-y-4">
          {exercise.menu.map((cat) => (
            <div key={cat.category}>
              <div className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-2 border-b border-emerald-500/20 pb-1">
                {cat.category}
              </div>
              <div className="space-y-1">
                {cat.items.map((it) => (
                  <div key={it.name} className="flex justify-between text-sm md:text-base">
                    <span>{it.name}</span>
                    <span className="font-mono text-muted-foreground">${it.price.toLocaleString("es-AR")}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="h-1.5 bg-muted rounded overflow-hidden mt-6">
          <div
            className="h-full bg-amber-500 transition-all duration-100"
            style={{ width: `${(timeLeft / exercise.studyDurationMs) * 100}%` }}
          />
        </div>

        <Button onClick={startQuestions} variant="ghost" size="sm" className="w-full mt-4 text-xs">
          Ya memoricé, pasar a las preguntas
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Preguntas del menú</span>
        <span className="flex items-center gap-1 text-amber-400">
          <EyeOff className="w-3 h-3" />
          el menú ya NO está visible
        </span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "p-3 rounded border border-red-500/40 dark:bg-red-950/50 bg-red-50"
            ) : "p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
                  type="text"
                  inputMode="text"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Respuesta"
                  className="h-10"
                />
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} size="lg" className="w-full h-12">
          Finalizar y ver resultados
        </Button>
      ) : (
        <Button
          onClick={() => onDone(
            exercise.questions.map((q, i) => ({
              q: q.q,
              userAnswer: answers[i],
              correct: check(answers[i], q.a),
              expected: q.a,
            })),
            Date.now() - startTimeRef.current
          )}
          size="lg"
          className="w-full h-12"
        >
          Continuar
        </Button>
      )}
    </Card>
  );
}

// ============ COMPONENTE PARA COMENSALES ============

export function CustomerOrdersRunner({ exercise, onDone }: {
  exercise: CustomerOrdersExercise;
  onDone: (results: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => void;
}) {
  const [phase, setPhase] = useState<"study" | "questions">("study");
  const [timeLeft, setTimeLeft] = useState(exercise.studyDurationMs);
  const [answers, setAnswers] = useState<string[]>(() => exercise.questions.map(() => ""));
  const [revealed, setRevealed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase !== "study") return;
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, exercise.studyDurationMs - (Date.now() - start));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(interval);
        startQuestions();
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exercise.id]);

  const startQuestions = () => {
    startTimeRef.current = Date.now();
    setPhase("questions");
  };

  const check = (ans: string, expected: string): boolean => smartMatch(ans, expected);

  if (phase === "study") {
    const seconds = Math.ceil(timeLeft / 1000);
    return (
      <Card className="p-6 md:p-8 border-amber-500/40 dark:bg-zinc-900 bg-amber-50">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <ChefHat className="w-3 h-3" />
            Comensales · nivel {exercise.difficulty}
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" />
            desaparece en {seconds}s
          </span>
        </div>

        <div className="space-y-3">
          {exercise.customers.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted">
              <div className="w-8 h-8 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-mono text-xs">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.orders.map((o, j) => (
                    <span key={j}>
                      {j > 0 && <span className="mx-1 text-amber-400">·</span>}
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-1.5 bg-muted rounded overflow-hidden mt-6">
          <div
            className="h-full bg-amber-500 transition-all duration-100"
            style={{ width: `${(timeLeft / exercise.studyDurationMs) * 100}%` }}
          />
        </div>

        <Button onClick={startQuestions} variant="ghost" size="sm" className="w-full mt-4 text-xs">
          Ya memoricé, pasar a las preguntas
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Preguntas de comensales</span>
        <span className="flex items-center gap-1 text-amber-400">
          <EyeOff className="w-3 h-3" />
          la lista ya NO está visible
        </span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "p-3 rounded border border-red-500/40 dark:bg-red-950/50 bg-red-50"
            ) : "p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
                  type="text"
                  inputMode="text"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Respuesta"
                  className="h-10"
                />
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} size="lg" className="w-full h-12">
          Finalizar y ver resultados
        </Button>
      ) : (
        <Button
          onClick={() => onDone(
            exercise.questions.map((q, i) => ({
              q: q.q,
              userAnswer: answers[i],
              correct: check(answers[i], q.a),
              expected: q.a,
            })),
            Date.now() - startTimeRef.current
          )}
          size="lg"
          className="w-full h-12"
        >
          Continuar
        </Button>
      )}
    </Card>
  );
}

// ============ COMPONENTE PARA COMANDA DE COCINA ============
// Fases: 1) estudio del estado inicial  2) secuencia de eventos  3) preguntas

export function KitchenComandaRunner({ exercise, onDone }: {
  exercise: KitchenComandaExercise;
  onDone: (results: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => void;
}) {
  const [phase, setPhase] = useState<"study" | "events" | "questions">("study");
  const [timeLeft, setTimeLeft] = useState(exercise.studyDurationMs);
  const [eventsShown, setEventsShown] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => exercise.questions.map(() => ""));
  const [revealed, setRevealed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  // Fase 1: countdown para estudiar el estado inicial
  useEffect(() => {
    if (phase !== "study") return;
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, exercise.studyDurationMs - (Date.now() - start));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(interval);
        enterEventsPhase();
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exercise.id]);

  // Fase 2: mostrar eventos uno por uno
  useEffect(() => {
    if (phase !== "events") return;
    if (eventsShown >= exercise.events.length) {
      startTimeRef.current = Date.now();
      setPhase("questions");
      return;
    }
    const ms = Math.round(exercise.eventsDurationMs / exercise.events.length);
    const timeout = setTimeout(() => {
      setEventsShown((n) => n + 1);
    }, ms);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, eventsShown, exercise.id]);

  const enterEventsPhase = () => {
    setPhase("events");
    setEventsShown(0);
  };

  const check = (ans: string, expected: string): boolean => smartMatch(ans, expected);

  // ---- FASE 1: ESTUDIO ----
  if (phase === "study") {
    const seconds = Math.ceil(timeLeft / 1000);
    return (
      <Card className="p-6 md:p-8 border-amber-500/40 dark:bg-zinc-900 bg-amber-50">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <ChefHat className="w-3 h-3" />
            Comandas activas · nivel {exercise.difficulty}
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" />
            desaparece en {seconds}s
          </span>
        </div>

        <div className="space-y-3">
          {exercise.initialState.map((t) => (
            <div key={t.table} className="p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted">
              <div className="text-sm font-mono uppercase tracking-wider text-emerald-400 mb-2">
                Mesa {t.table}
              </div>
              <div className="space-y-1">
                {t.courses.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize">{c.course}</span>
                    <span>{c.dish}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="h-1.5 bg-muted rounded overflow-hidden mt-6">
          <div
            className="h-full bg-amber-500 transition-all duration-100"
            style={{ width: `${(timeLeft / exercise.studyDurationMs) * 100}%` }}
          />
        </div>

        <Button onClick={enterEventsPhase} variant="ghost" size="sm" className="w-full mt-4 text-xs">
          Ya memoricé, empezar a cantar comandas
        </Button>
      </Card>
    );
  }

  // ---- FASE 2: EVENTOS EN SECUENCIA ----
  if (phase === "events") {
    const current = exercise.events[eventsShown];
    const total = exercise.events.length;
    const ms = Math.round(exercise.eventsDurationMs / total);
    const secondsLeft = Math.ceil((ms * (total - eventsShown)) / 1000);

    return (
      <Card className="p-6 md:p-8 border-emerald-500/40 dark:bg-zinc-900 bg-emerald-50">
        <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <ChefHat className="w-3 h-3" />
            Cantando comandas · evento {Math.min(eventsShown + 1, total)} / {total}
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Clock className="w-3 h-3" />
            {eventsShown < total ? `próximo en ${secondsLeft}s` : "listo"}
          </span>
        </div>

        <div className="text-center py-10">
          {eventsShown < total && current ? (
            <>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                SALE
              </div>
              <div className="text-3xl md:text-5xl font-bold text-emerald-300 mb-2">
                Mesa {current.table}
              </div>
              <div className="text-lg md:text-2xl text-foreground capitalize">
                {current.course}: {current.dish}
              </div>
            </>
          ) : (
            <div className="text-2xl text-muted-foreground">Fin de comandas</div>
          )}
        </div>

        <div className="h-1.5 bg-muted rounded overflow-hidden mt-6">
          <div
            className="h-full bg-emerald-500 transition-all duration-100"
            style={{ width: `${(eventsShown / total) * 100}%` }}
          />
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Llevá el control mentalmente. No anotes.
        </div>
      </Card>
    );
  }

  // ---- FASE 3: PREGUNTAS ----
  return (
    <Card className="p-6 md:p-8 border-border/60 dark:bg-zinc-900 bg-card">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Preguntas sobre el estado final</span>
        <span className="flex items-center gap-1 text-amber-400">
          <EyeOff className="w-3 h-3" />
          las comandas ya NO están visibles
        </span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 dark:bg-emerald-950/50 bg-emerald-50" : "p-3 rounded border border-red-500/40 dark:bg-red-950/50 bg-red-50"
            ) : "p-3 rounded border border-border/40 dark:bg-zinc-800 bg-muted"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
                  type="text"
                  inputMode="text"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Respuesta"
                  className="h-10"
                />
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} size="lg" className="w-full h-12">
          Finalizar y ver resultados
        </Button>
      ) : (
        <Button
          onClick={() => onDone(
            exercise.questions.map((q, i) => ({
              q: q.q,
              userAnswer: answers[i],
              correct: check(answers[i], q.a),
              expected: q.a,
            })),
            Date.now() - startTimeRef.current
          )}
          size="lg"
          className="w-full h-12"
        >
          Continuar
        </Button>
      )}
    </Card>
  );
}
