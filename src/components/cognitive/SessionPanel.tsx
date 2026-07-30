"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Clock, Trophy, Target, Zap, TrendingUp } from "lucide-react";
import {
  SESSIONS,
  type SessionPlan,
  type BaseExercise,
  type RetentionExercise,
  type MultitaskScenario,
} from "@/lib/cognitive-engine";
import { ExerciseRunner, RetentionRunner, MultitaskRunner } from "./ExerciseRunner";
import { saveSession, type SessionRecord, type ExerciseResult } from "@/lib/cognitive-storage";

interface Props {
  day: SessionPlan["day"];
  onExit: () => void;
  onComplete: (record: SessionRecord) => void;
}

export function SessionPanel({ day, onExit, onComplete }: Props) {
  const session = SESSIONS[day];
  const [exercises, setExercises] = useState<BaseExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [finalRecord, setFinalRecord] = useState<SessionRecord | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    setExercises(session.exercises());
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
    setFinalRecord(null);
    startTimeRef.current = Date.now();
  }, [day, session]);

  const recordAnswer = (correct: boolean, timeMs: number, userAnswer: string) => {
    const ex = exercises[currentIndex];
    if (!ex) return;
    setResults((r) => [
      ...r,
      {
        exerciseId: ex.id,
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
      finishSession();
    }
  };

  // Para retención/multitarea que retornan resultados en bloque
  const recordMultiResult = (qResults: { q: string; userAnswer: string; correct: boolean; expected: string }[], timeMs: number) => {
    const ex = exercises[currentIndex];
    if (!ex) return;
    const newResults: ExerciseResult[] = qResults.map((r, i) => ({
      exerciseId: ex.id + "_" + i,
      type: ex.type,
      skill: ex.skill,
      correct: r.correct,
      userAnswer: r.userAnswer,
      expected: r.expected,
      timeMs: timeMs / qResults.length,
    }));
    setResults((r) => [...r, ...newResults]);
    setTimeout(() => finishSession(newResults), 100);
  };

  const finishSession = (extraResults?: ExerciseResult[]) => {
    const allResults = extraResults ?? results;
    const durationMs = Date.now() - startTimeRef.current;
    const totalCorrect = allResults.filter((r) => r.correct).length;
    const totalAnswered = allResults.length;
    const avgTimeMs = totalAnswered > 0 ? allResults.reduce((s, r) => s + r.timeMs, 0) / totalAnswered : 0;

    const record: SessionRecord = {
      id: crypto.randomUUID(),
      day,
      date: new Date().toISOString(),
      results: allResults,
      totalCorrect,
      totalAnswered,
      avgTimeMs,
      durationMs,
    };
    // Fire and forget — si falla Supabase, ya quedó guardado el record en estado
    saveSession(record).catch(() => {});
    setFinalRecord(record);
    setFinished(true);
    onComplete(record);
  };

  if (exercises.length === 0) {
    return <div className="text-center text-muted-foreground">Cargando…</div>;
  }

  if (finished && finalRecord) {
    return <SessionSummary record={finalRecord} onExit={onExit} />;
  }

  const current = exercises[currentIndex];
  const isRetention = current.type === "retention";
  const isMultitask = current.type === "multitask";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Salir
        </Button>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {session.title} · {day}
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
            style={{ width: `${((currentIndex) / exercises.length) * 100}%` }}
          />
        </div>
      </div>

      {isRetention ? (
        <RetentionRunner
          exercise={current as RetentionExercise}
          onDone={recordMultiResult}
        />
      ) : isMultitask ? (
        <MultitaskRunner
          exercise={current as MultitaskScenario}
          onDone={recordMultiResult}
        />
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

// ============ RESUMEN DE SESIÓN ============

function SessionSummary({ record, onExit }: { record: SessionRecord; onExit: () => void }) {
  const accuracy = record.totalAnswered > 0 ? record.totalCorrect / record.totalAnswered : 0;
  const mins = Math.round(record.durationMs / 60000);
  const secs = Math.round((record.durationMs % 60000) / 1000);
  const avgSec = Math.round(record.avgTimeMs / 1000);

  const bySkill: Record<string, { correct: number; total: number }> = {};
  for (const r of record.results) {
    if (!bySkill[r.skill]) bySkill[r.skill] = { correct: 0, total: 0 };
    bySkill[r.skill].total++;
    if (r.correct) bySkill[r.skill].correct++;
  }

  let verdict = "";
  let verdictColor = "";
  if (accuracy >= 0.85) {
    verdict = "Sólido. Mantené el ritmo y subí dificultad la próxima semana.";
    verdictColor = "text-emerald-300";
  } else if (accuracy >= 0.6) {
    verdict = "Zona de trabajo. Vas a ver mejora en 2-3 semanas si sostenés.";
    verdictColor = "text-amber-300";
  } else {
    verdict = "Fricción alta. Eso es exactamente lo que hay que entrenar. No bajes dificultad, repetí el día mañana.";
    verdictColor = "text-red-300";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Sesión completada
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {accuracy >= 0.85 ? "Bien hecho" : accuracy >= 0.6 ? "Trabajo hecho" : "Duro pero útil"}
        </h1>
        <p className={`text-sm md:text-base ${verdictColor}`}>{verdict}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="p-4 text-center">
          <Target className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
          <div className="text-2xl font-bold">{Math.round(accuracy * 100)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Accuracy</div>
        </Card>
        <Card className="p-4 text-center">
          <Trophy className="w-5 h-5 mx-auto mb-2 text-amber-400" />
          <div className="text-2xl font-bold">{record.totalCorrect}/{record.totalAnswered}</div>
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

      <Card className="p-6 mb-6">
        <div className="text-sm font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Por habilidad
        </div>
        <div className="space-y-3">
          {Object.entries(bySkill).map(([skill, s]) => (
            <div key={skill}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-mono uppercase text-xs tracking-wider text-muted-foreground">{skill}</span>
                <span className="font-mono">{s.correct}/{s.total}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className={`h-full ${s.correct / s.total >= 0.7 ? "bg-emerald-500" : s.correct / s.total >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${(s.correct / s.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Button onClick={onExit} size="lg" className="w-full h-12">
        Volver al dashboard
      </Button>
    </div>
  );
}
