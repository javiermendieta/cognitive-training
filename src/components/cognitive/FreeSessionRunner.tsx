"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, X, Clock, Trophy, Target, Zap, TrendingUp, RefreshCw } from "lucide-react";
import type {
  BaseExercise,
  RetentionExercise,
  MultitaskScenario,
  MenuStudyExercise,
  CustomerOrdersExercise,
  KitchenComandaExercise,
} from "@/lib/cognitive-engine";
import {
  ExerciseRunner,
  RetentionRunner,
  MultitaskRunner,
  MenuStudyRunner,
  CustomerOrdersRunner,
  KitchenComandaRunner,
} from "./ExerciseRunner";

interface Props {
  exercises: BaseExercise[];
  onExit: () => void;          // vuelve al selector de modo libre
  onExitAll: () => void;       // vuelve al dashboard
}

interface ResultRow {
  type: string;
  skill: string;
  correct: boolean;
  userAnswer: string;
  expected: string;
  timeMs: number;
}

export function FreeSessionRunner({ exercises, onExit, onExitAll }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [finished, setFinished] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const recordAnswer = (correct: boolean, timeMs: number, userAnswer: string) => {
    const ex = exercises[currentIndex];
    if (!ex) return;
    setResults((r) => [
      ...r,
      {
        type: ex.type,
        skill: ex.skill,
        correct,
        userAnswer,
        expected: ex.validate(userAnswer).expected,
        timeMs,
      },
    ]);
  };

  const goNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  };

  const recordMultiResult = (
    qResults: { q: string; userAnswer: string; correct: boolean; expected: string }[],
    timeMs: number
  ) => {
    const ex = exercises[currentIndex];
    if (!ex) return;
    const newRows: ResultRow[] = qResults.map((r) => ({
      type: ex.type,
      skill: ex.skill,
      correct: r.correct,
      userAnswer: r.userAnswer,
      expected: r.expected,
      timeMs: timeMs / qResults.length,
    }));
    setResults((r) => [...r, ...newRows]);
    setTimeout(() => {
      if (currentIndex < exercises.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setFinished(true);
      }
    }, 100);
  };

  if (finished) {
    return <FreeSummary results={results} onExit={onExit} onExitAll={onExitAll} durationMs={Date.now() - startTimeRef.current} />;
  }

  const current = exercises[currentIndex];
  const isRetention = current.type === "retention";
  const isMultitask = current.type === "multitask";
  const isMenuStudy = current.type === "menu_study";
  const isCustomerOrders = current.type === "customer_orders";
  const isKitchenComanda = current.type === "kitchen_comanda";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Salir
        </Button>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Modo libre · {currentIndex + 1} / {exercises.length}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 text-xs font-mono text-muted-foreground">
          <span>Progreso</span>
          <span>{currentIndex + 1} / {exercises.length}</span>
        </div>
        <div className="h-1 bg-muted rounded overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(currentIndex / exercises.length) * 100}%` }}
          />
        </div>
      </div>

      {isRetention ? (
        <RetentionRunner exercise={current as RetentionExercise} onDone={recordMultiResult} />
      ) : isMultitask ? (
        <MultitaskRunner exercise={current as MultitaskScenario} onDone={recordMultiResult} />
      ) : isMenuStudy ? (
        <MenuStudyRunner exercise={current as MenuStudyExercise} onDone={recordMultiResult} />
      ) : isCustomerOrders ? (
        <CustomerOrdersRunner exercise={current as CustomerOrdersExercise} onDone={recordMultiResult} />
      ) : isKitchenComanda ? (
        <KitchenComandaRunner exercise={current as KitchenComandaExercise} onDone={recordMultiResult} />
      ) : (
        <ExerciseRunner
          exercise={current}
          index={currentIndex}
          total={exercises.length}
          onAnswer={recordAnswer}
          onNext={goNext}
          isLast={currentIndex === exercises.length - 1}
        />
      )}
    </div>
  );
}

// ============ RESUMEN MODO LIBRE ============

function FreeSummary({
  results,
  onExit,
  onExitAll,
  durationMs,
}: {
  results: ResultRow[];
  onExit: () => void;
  onExitAll: () => void;
  durationMs: number;
}) {
  const totalAnswered = results.length;
  const totalCorrect = results.filter((r) => r.correct).length;
  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
  const avgTimeMs = totalAnswered > 0 ? results.reduce((s, r) => s + r.timeMs, 0) / totalAnswered : 0;
  const mins = Math.round(durationMs / 60000);
  const secs = Math.round((durationMs % 60000) / 1000);
  const avgSec = Math.round(avgTimeMs / 1000);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Práctica completada
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {accuracy >= 0.85 ? "Muy bien" : accuracy >= 0.6 ? "Bien" : "A seguir practicando"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Esto no cuenta para el historial oficial. Es solo práctica libre.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="p-4 text-center">
          <Target className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
          <div className="text-2xl font-bold">{Math.round(accuracy * 100)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Accuracy</div>
        </Card>
        <Card className="p-4 text-center">
          <Trophy className="w-5 h-5 mx-auto mb-2 text-amber-400" />
          <div className="text-2xl font-bold">{totalCorrect}/{totalAnswered}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Aciertos</div>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-2 text-blue-400" />
          <div className="text-2xl font-bold">{avgSec}s</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tiempo medio</div>
        </Card>
        <Card className="p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{mins}:{secs.toString().padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
        </Card>
      </div>

      {/* Detalle por ejercicio */}
      <Card className="p-6 mb-6">
        <div className="text-sm font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Detalle
        </div>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {r.correct ? (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className="font-mono text-xs text-muted-foreground truncate">{r.type}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {Math.round(r.timeMs / 1000)}s
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button onClick={onExit} size="lg" variant="outline" className="flex-1 h-12">
          <RefreshCw className="w-4 h-4 mr-2" />
          Practicar otro
        </Button>
        <Button onClick={onExitAll} size="lg" className="flex-1 h-12">
          Volver al dashboard
        </Button>
      </div>
    </div>
  );
}
