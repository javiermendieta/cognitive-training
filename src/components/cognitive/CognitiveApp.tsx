"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Brain,
  Calendar,
  Flame,
  TrendingUp,
  ChevronRight,
  Trash2,
  Trophy,
  Target,
  Zap,
  RefreshCw,
  Dumbbell,
} from "lucide-react";
import {
  SESSIONS,
  DAY_ORDER,
  getTodaySession,
  type SessionPlan,
} from "@/lib/cognitive-engine";
import { getStats, clearHistory, type StatsData } from "@/lib/cognitive-storage";
import { useAuth } from "@/hooks/useAuth";
import { SessionPanel } from "./SessionPanel";
import { AuthBar } from "./AuthBar";
import { FreeModePanel } from "./FreeModePanel";

type View = "dashboard" | "session" | "stats" | "free";

export function CognitiveApp() {
  const [view, setView] = useState<View>("dashboard");
  const [activeDay, setActiveDay] = useState<SessionPlan["day"]>("lunes");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsNonce, setStatsNonce] = useState(0);
  const { user, loading: authLoading, login, register, logout } = useAuth();

  // Refrescar stats cuando cambia el user o la view (vía nonce)
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    getStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, view, statsNonce]);

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const startSession = (day: SessionPlan["day"]) => {
    setActiveDay(day);
    setView("session");
  };

  const handleClearHistory = async () => {
    if (confirm("¿Borrar todo el historial? No se puede deshacer.")) {
      await clearHistory();
      setStatsNonce((n) => n + 1);
    }
  };

  if (view === "session") {
    return (
      <SessionPanel
        day={activeDay}
        onExit={() => handleViewChange("dashboard")}
        onComplete={() => setStatsNonce((n) => n + 1)}
      />
    );
  }

  if (view === "free") {
    return <FreeModePanel onExit={() => handleViewChange("dashboard")} />;
  }

  if (view === "stats") {
    return (
      <StatsPanel
        stats={stats}
        onBack={() => handleViewChange("dashboard")}
        onClear={handleClearHistory}
        user={user}
        onLogin={login}
        onRegister={register}
        onLogout={logout}
      />
    );
  }

  return (
    <Dashboard
      stats={stats}
      onStart={startSession}
      onFreeMode={() => handleViewChange("free")}
      onSeeStats={() => handleViewChange("stats")}
      user={user}
      onLogin={login}
      onRegister={register}
      onLogout={logout}
    />
  );
}

// ============ DASHBOARD ============

function Dashboard({ stats, onStart, onFreeMode, onSeeStats, user, onLogin, onRegister, onLogout }: {
  stats: StatsData | null;
  onStart: (day: SessionPlan["day"]) => void;
  onFreeMode: () => void;
  onSeeStats: () => void;
  user: { email?: string } | null;
  onLogin: (email: string, password: string) => Promise<{ error: string | null }>;
  onRegister: (email: string, password: string) => Promise<{ error: string | null }>;
  onLogout: () => Promise<void>;
}) {
  const today = getTodaySession();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* HEADER */}
      <div className="mb-8 md:mb-10">
        <div className="flex items-center gap-2 mb-3 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Brain className="w-3.5 h-3.5" />
          Sistema de entrenamiento cognitivo
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          10 minutos.
          <br />
          <span className="text-muted-foreground">5 días. Sin excusas.</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
          Plan rotativo de lunes a viernes. Cada día golpea un punto ciego distinto:
          buffer de trabajo, cálculo cotidiano, retención, multitarea y velocidad.
        </p>
      </div>

      {/* SYNC BAR */}
      <div className="mb-8">
        <AuthBar user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
      </div>

      {/* STATS GLOBALES */}
      {stats && stats.totalSessions > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Racha</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.streak}</div>
            <div className="text-[10px] text-muted-foreground">días seguidos</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Sesiones</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.totalSessions}</div>
            <div className="text-[10px] text-muted-foreground">completadas</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Target className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Accuracy</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{Math.round(stats.overallAccuracy * 100)}%</div>
            <div className="text-[10px] text-muted-foreground">promedio global</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Velocidad</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{Math.round(stats.avgTimeMs / 1000)}s</div>
            <div className="text-[10px] text-muted-foreground">tiempo medio/ej.</div>
          </Card>
        </div>
      )}

      {/* ACCIÓN HOY */}
      <Card className="p-5 md:p-6 mb-8 border-emerald-500/40 dark:bg-zinc-900 bg-emerald-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1">
              Hoy te toca
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-1">{SESSIONS[today].title}</h3>
            <p className="text-sm text-muted-foreground">{SESSIONS[today].focus}</p>
          </div>
          <Button
            size="lg"
            onClick={() => onStart(today)}
            className="h-12 px-6 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700"
          >
            Empezar ahora
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* MODO LIBRE */}
      <Card
        className="p-5 md:p-6 mb-8 border-purple-500/30 bg-purple-500/5 cursor-pointer hover:bg-purple-500/10 transition-all"
        onClick={onFreeMode}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-0.5">Modo libre</h3>
              <p className="text-sm text-muted-foreground">
                Elegí tipo de ejercicio + nivel + cantidad. Practicá lo que quieras, sin seguir la rotación.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </div>
      </Card>

      {/* SESIONES POR DÍA */}
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Rotación semanal
        </div>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => {
            const s = SESSIONS[day];
            const isToday = day === today;
            return (
              <Card
                key={day}
                className={`p-4 md:p-5 transition-all hover:bg-accent/40 cursor-pointer ${isToday ? "border-emerald-500/40" : ""}`}
                onClick={() => onStart(day)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xs uppercase ${isToday ? "bg-emerald-500/20 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                      {day.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold mb-0.5 flex items-center gap-2">
                        {s.title}
                        {isToday && (
                          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                            · hoy
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{s.subtitle}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* REGLAS */}
      <Card className="p-5 md:p-6 mb-8 border-border/60 dark:bg-zinc-900 bg-card">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Reglas operativas
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="text-emerald-400">→</span>
            <span>10 minutos por sesión. Ni más, ni menos. La mejora viene de la repetición diaria, no del volumen puntual.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">→</span>
            <span>Sin calculadora. Ni siquiera para verificar. Verificás con la del celular recién después de anotar tu resultado mental.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">→</span>
            <span>No te saltes el martes. El porcentaje invertido es el punto más bajo. Si solo pudieras hacer un día, hacé el martes.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">→</span>
            <span>Si te equivocás, no lo corrijas. Pasás al siguiente. Midieron velocidad y precisión, no perfección.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">→</span>
            <span>Re-evaluación a las 8 semanas. Si no mejorás, ajustamos el plan.</span>
          </li>
        </ul>
      </Card>

      {/* VER ESTADÍSTICAS */}
      {stats && stats.totalSessions > 0 && (
        <Button variant="outline" onClick={onSeeStats} className="w-full h-11">
          <TrendingUp className="w-4 h-4 mr-2" />
          Ver historial completo
        </Button>
      )}

      <footer className="mt-12 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
        Sistema basado en tu evaluación cognitiva inicial · Sin wokismo, sin motivación barata
      </footer>
    </div>
  );
}

// ============ PANEL DE ESTADÍSTICAS ============

function StatsPanel({ stats, onBack, onClear, user, onLogin, onRegister, onLogout }: {
  stats: StatsData | null;
  onBack: () => void;
  onClear: () => Promise<void>;
  user: { email?: string } | null;
  onLogin: (email: string, password: string) => Promise<{ error: string | null }>;
  onRegister: (email: string, password: string) => Promise<{ error: string | null }>;
  onLogout: () => Promise<void>;
}) {
  if (!stats) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (stats.totalSessions === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Todavía no hay sesiones registradas.</p>
        <Button onClick={onBack}>Volver</Button>
      </div>
    );
  }

  const skillLabels: Record<string, string> = {
    buffer: "Buffer de trabajo",
    calc: "Cálculo",
    retention: "Retención",
    multitask: "Multitarea",
    speed: "Velocidad",
    semantic: "Semántica fina",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-6">
        ← Volver
      </Button>

      <h2 className="text-2xl md:text-3xl font-bold mb-4">Tu historial</h2>

      <div className="mb-6">
        <AuthBar user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="p-4 text-center">
          <Flame className="w-5 h-5 mx-auto mb-2 text-orange-400" />
          <div className="text-2xl font-bold">{stats.streak}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Racha</div>
        </Card>
        <Card className="p-4 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-2 text-blue-400" />
          <div className="text-2xl font-bold">{stats.totalSessions}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sesiones</div>
        </Card>
        <Card className="p-4 text-center">
          <Target className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
          <div className="text-2xl font-bold">{Math.round(stats.overallAccuracy * 100)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Accuracy</div>
        </Card>
        <Card className="p-4 text-center">
          <Zap className="w-5 h-5 mx-auto mb-2 text-purple-400" />
          <div className="text-2xl font-bold">{Math.round(stats.avgTimeMs / 1000)}s</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">T/ej.</div>
        </Card>
      </div>

      {/* Por habilidad */}
      <Card className="p-6 mb-6">
        <div className="text-sm font-medium mb-4">Progreso por habilidad</div>
        <div className="space-y-4">
          {Object.entries(stats.bySkill).map(([skill, s]) => {
            const acc = s.count > 0 ? s.correct / s.count : 0;
            const label = skillLabels[skill] || skill;
            return (
              <div key={skill}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {s.correct}/{s.count} · {Math.round(acc * 100)}% · {Math.round(s.avgTimeMs / 1000)}s
                  </span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full transition-all ${acc >= 0.7 ? "bg-emerald-500" : acc >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${acc * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Últimas sesiones */}
      <Card className="p-6 mb-6">
        <div className="text-sm font-medium mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Últimas 7 sesiones
        </div>
        <div className="space-y-2">
          {[...stats.last7].reverse().map((s, i) => {
            const d = new Date(s.date);
            return (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <div className="text-sm font-medium capitalize">{s.day}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${s.accuracy >= 0.7 ? "text-emerald-400" : s.accuracy >= 0.4 ? "text-amber-400" : "text-red-400"}`}>
                    {Math.round(s.accuracy * 100)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Button variant="outline" onClick={onClear} className="w-full h-10 text-red-400 hover:text-red-300">
        <Trash2 className="w-4 h-4 mr-2" />
        Borrar historial
      </Button>
    </div>
  );
}
