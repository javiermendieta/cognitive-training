"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Dumbbell, Layers, ChevronRight } from "lucide-react";
import {
  EXERCISE_CATALOG,
  generateCustomSet,
  type BaseExercise,
} from "@/lib/cognitive-engine";
import { FreeSessionRunner } from "./FreeSessionRunner";

interface Props {
  onExit: () => void;
}

type Difficulty = 1 | 2 | 3;

export function FreeModePanel({ onExit }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [count, setCount] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [exercises, setExercises] = useState<BaseExercise[]>([]);

  // Agrupar catálogo por categoría
  const categories: Record<string, typeof EXERCISE_CATALOG> = {};
  for (const entry of EXERCISE_CATALOG) {
    if (!categories[entry.category]) categories[entry.category] = [];
    categories[entry.category].push(entry);
  }

  const start = () => {
    if (!selectedType) return;
    const set = generateCustomSet(selectedType, difficulty, count);
    setExercises(set);
    setRunning(true);
  };

  if (running && exercises.length > 0) {
    return (
      <FreeSessionRunner
        exercises={exercises}
        onExit={() => {
          setRunning(false);
          setExercises([]);
        }}
        onExitAll={onExit}
      />
    );
  }

  const selectedEntry = EXERCISE_CATALOG.find((e) => e.type === selectedType);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Dumbbell className="w-3 h-3" />
          Modo libre
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          Elegí qué entrenar
        </h1>
        <p className="text-base text-muted-foreground">
          Seleccioná un tipo de ejercicio. Después elegí nivel y cantidad.
          No se guarda en el historial oficial, es pura práctica.
        </p>
      </div>

      {/* Catálogo por categoría */}
      <div className="space-y-6 mb-8">
        {Object.entries(categories).map(([cat, entries]) => (
          <div key={cat}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {cat}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {entries.map((entry) => {
                const isSelected = selectedType === entry.type;
                return (
                  <Card
                    key={entry.type}
                    className={`p-4 cursor-pointer transition-all hover:bg-accent/40 ${isSelected ? "border-emerald-500/60 bg-emerald-500/5" : ""}`}
                    onClick={() => setSelectedType(entry.type)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold mb-1">{entry.label}</div>
                        <div className="text-xs text-muted-foreground">{entry.description}</div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          <span>skill: {entry.skill}</span>
                          {entry.supportsDifficulty && (
                            <span className="text-emerald-400">· 3 niveles</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Configuración */}
      {selectedEntry && (
        <Card className="p-5 md:p-6 mb-6 border-emerald-500/30 bg-emerald-500/5 sticky bottom-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
                  Configuración
                </div>
                <h3 className="text-lg font-bold">{selectedEntry.label}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nivel */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Nivel</div>
                <div className="flex gap-2">
                  {selectedEntry.supportsDifficulty ? (
                    [
                      { v: 1 as Difficulty, label: "1 · Fácil" },
                      { v: 2 as Difficulty, label: "2 · Medio" },
                      { v: 3 as Difficulty, label: "3 · Difícil" },
                    ].map((opt) => (
                      <Button
                        key={opt.v}
                        size="sm"
                        variant={difficulty === opt.v ? "default" : "outline"}
                        onClick={() => setDifficulty(opt.v)}
                        className="flex-1 h-10"
                      >
                        {opt.label}
                      </Button>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic h-10 flex items-center">
                      Nivel único (no configurable)
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Cantidad</div>
                <div className="flex gap-2">
                  {[3, 5, 10, 15].map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={count === c ? "default" : "outline"}
                      onClick={() => setCount(c)}
                      className="flex-1 h-10"
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={start}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
            >
              Empezar {count} {count === 1 ? "ejercicio" : "ejercicios"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
