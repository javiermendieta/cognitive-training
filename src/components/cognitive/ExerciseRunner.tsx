"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Check, X, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import type { BaseExercise, RetentionExercise, MultitaskScenario } from "@/lib/cognitive-engine";

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

  useEffect(() => {
    startTimeRef.current = Date.now();
    setInput("");
    setRevealed(false);
    setFeedback(null);
  }, [exercise.id]);

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

  return (
    <Card className="p-6 md:p-8 border-border/50 bg-card/50 backdrop-blur">
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

      <div className="text-lg md:text-2xl font-medium whitespace-pre-wrap leading-relaxed mb-6">
        {exercise.prompt}
      </div>

      {!revealed ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <Input
            autoFocus
            type="text"
            inputMode="numeric"
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
          <div className={`p-4 rounded-lg border ${feedback?.correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
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

  const check = (ans: string, expected: string): boolean => {
    const a = ans.trim().toLowerCase();
    const e = expected.toLowerCase();
    if (a.length < 2) return false;
    return a.includes(e.slice(0, Math.min(4, e.length))) || e.includes(a.slice(0, Math.min(4, a.length)));
  };

  const finish = () => {
    setRevealed(true);
  };

  if (phase === "reading") {
    return (
      <Card className="p-6 md:p-8 border-border/50 bg-card/50 backdrop-blur">
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
    <Card className="p-6 md:p-8 border-border/50 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Fase 2: Preguntas</span>
        <span>El texto ya NO está visible</span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 bg-emerald-500/10" : "p-3 rounded border border-red-500/40 bg-red-500/10"
            ) : "p-3 rounded border border-border/40 bg-background/30"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
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

  const check = (ans: string, expected: string): boolean => {
    const a = ans.trim().toLowerCase();
    const e = expected.toLowerCase();
    if (a.length < 2) return false;
    return a.includes(e.slice(0, Math.min(4, e.length))) || e.includes(a.slice(0, Math.min(4, a.length)));
  };

  const finish = () => {
    setRevealed(true);
  };

  if (phase === "reading") {
    return (
      <Card className="p-6 md:p-8 border-border/50 bg-card/50 backdrop-blur">
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
    <Card className="p-6 md:p-8 border-border/50 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between mb-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>Preguntas</span>
        <span>El escenario ya NO está visible</span>
      </div>

      <div className="space-y-4 mb-6">
        {exercise.questions.map((q, i) => {
          const ok = check(answers[i], q.a);
          return (
            <div key={i} className={revealed ? (
              ok ? "p-3 rounded border border-emerald-500/40 bg-emerald-500/10" : "p-3 rounded border border-red-500/40 bg-red-500/10"
            ) : "p-3 rounded border border-border/40 bg-background/30"}>
              <div className="text-sm text-muted-foreground mb-1">P{i + 1}: {q.q}</div>
              {revealed ? (
                <>
                  <div className="text-base">Tu respuesta: <span className="font-mono">{answers[i] || "—"}</span></div>
                  <div className="text-sm text-muted-foreground">Esperada: <span className="font-mono">{q.a}</span></div>
                </>
              ) : (
                <Input
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
