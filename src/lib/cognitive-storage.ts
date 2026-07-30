// Storage layer: usa Supabase si el usuario está logueado, sino localStorage
import type { BaseExercise } from "./cognitive-engine";

export interface ExerciseResult {
  exerciseId: string;
  type: string;
  skill: string;
  correct: boolean;
  userAnswer: string;
  expected: string;
  timeMs: number;
}

export interface SessionRecord {
  id: string;
  day: string;
  date: string; // ISO
  results: ExerciseResult[];
  totalCorrect: number;
  totalAnswered: number;
  avgTimeMs: number;
  durationMs: number;
}

export interface StatsData {
  totalSessions: number;
  totalExercises: number;
  overallAccuracy: number;
  avgTimeMs: number;
  bySkill: Record<string, { count: number; correct: number; avgTimeMs: number }>;
  last7: { date: string; day: string; accuracy: number }[];
  streak: number;
}

const LOCAL_KEY = "cog_training_history_v1";

// ===== LOCAL STORAGE (fallback / offline) =====

function loadLocalHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalSession(rec: SessionRecord) {
  const hist = loadLocalHistory();
  hist.push(rec);
  const trimmed = hist.slice(-200);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
}

function clearLocalHistory() {
  localStorage.removeItem(LOCAL_KEY);
}

// ===== SUPABASE =====

async function getSupabase() {
  const { createClient, isSupabaseConfigured } = await import("./supabase-client");
  if (!isSupabaseConfigured()) return null;
  return createClient();
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function loadRemoteHistory(): Promise<SessionRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cognitive_sessions")
    .select("*")
    .order("date", { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((row: unknown) => {
    const r = row as {
      id: string;
      day: string;
      date: string;
      results: ExerciseResult[];
      total_correct: number;
      total_answered: number;
      avg_time_ms: number;
      duration_ms: number;
    };
    return {
      id: r.id,
      day: r.day,
      date: r.date,
      results: r.results,
      totalCorrect: r.total_correct,
      totalAnswered: r.total_answered,
      avgTimeMs: r.avg_time_ms,
      durationMs: r.duration_ms,
    } as SessionRecord;
  });
}

async function saveRemoteSession(rec: SessionRecord): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("cognitive_sessions").insert({
    id: rec.id,
    user_id: userId,
    day: rec.day,
    date: rec.date,
    results: rec.results,
    total_correct: rec.totalCorrect,
    total_answered: rec.totalAnswered,
    avg_time_ms: rec.avgTimeMs,
    duration_ms: rec.durationMs,
  });
  return !error;
}

async function clearRemoteHistory(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("cognitive_sessions")
    .delete()
    .eq("user_id", userId);
  return !error;
}

// ===== API PÚBLICA (decide automáticamente local vs remoto) =====

export async function loadHistory(): Promise<SessionRecord[]> {
  // Si hay usuario logueado, usar Supabase
  const userId = await getCurrentUserId();
  if (userId) {
    return loadRemoteHistory();
  }
  return loadLocalHistory();
}

// Mantener versión sync para compatibilidad con código existente
export function loadHistorySync(): SessionRecord[] {
  return loadLocalHistory();
}

export async function saveSession(rec: SessionRecord): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    await saveRemoteSession(rec);
  } else {
    saveLocalSession(rec);
  }
}

// Versión sync (siempre local) — usada en lugares donde no podemos ser async fácilmente
export function saveSessionSync(rec: SessionRecord) {
  saveLocalSession(rec);
}

export async function clearHistory(): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    await clearRemoteHistory();
  }
  clearLocalHistory();
}

export async function getStats(): Promise<StatsData> {
  const hist = await loadHistory();
  return computeStatsFromHistory(hist);
}

// Versión sync (local) para uso en initial state
export function getStatsSync(): StatsData {
  const hist = loadLocalHistory();
  return computeStatsFromHistory(hist);
}

function computeStatsFromHistory(hist: SessionRecord[]): StatsData {
  if (hist.length === 0) {
    return {
      totalSessions: 0,
      totalExercises: 0,
      overallAccuracy: 0,
      avgTimeMs: 0,
      bySkill: {},
      last7: [],
      streak: 0,
    };
  }

  let totalExercises = 0;
  let totalCorrect = 0;
  let totalTime = 0;
  let timeCount = 0;
  const bySkill: Record<string, { count: number; correct: number; totalTime: number }> = {};

  for (const s of hist) {
    for (const r of s.results) {
      totalExercises++;
      if (r.correct) totalCorrect++;
      if (r.timeMs > 0) {
        totalTime += r.timeMs;
        timeCount++;
      }
      if (!bySkill[r.skill]) bySkill[r.skill] = { count: 0, correct: 0, totalTime: 0 };
      bySkill[r.skill].count++;
      if (r.correct) bySkill[r.skill].correct++;
      bySkill[r.skill].totalTime += r.timeMs;
    }
  }

  // Racha: días consecutivos con al menos 1 sesión, hasta hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const seen = new Set(hist.map((h) => new Date(h.date).toISOString().slice(0, 10)));
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (seen.has(iso)) streak++;
    else if (i > 0) break;
  }

  const last7 = hist.slice(-7).map((s) => ({
    date: s.date,
    day: s.day,
    accuracy: s.totalAnswered > 0 ? s.totalCorrect / s.totalAnswered : 0,
  }));

  return {
    totalSessions: hist.length,
    totalExercises,
    overallAccuracy: totalExercises > 0 ? totalCorrect / totalExercises : 0,
    avgTimeMs: timeCount > 0 ? totalTime / timeCount : 0,
    bySkill: Object.fromEntries(
      Object.entries(bySkill).map(([k, v]) => [
        k,
        {
          count: v.count,
          correct: v.correct,
          avgTimeMs: v.count > 0 ? v.totalTime / v.count : 0,
        },
      ])
    ) as Record<string, { count: number; correct: number; avgTimeMs: number }>,
    last7,
    streak,
  };
}

// ===== AUTH HELPERS =====

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = await getSupabase();
  if (!supabase) {
    return {
      error:
        "Supabase no está configurado. Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = await getSupabase();
  if (!supabase) {
    return {
      error:
        "Supabase no está configurado. Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Si ya hay sesión, no hace falta confirmar nada
  if (data.session) return { error: null };

  // Si no hay sesión, significa que Supabase requiere confirmación por email.
  // Llamamos a nuestro endpoint server-side (usa service role key) para
  // confirmar el email automáticamente y poder entrar sin esperar el correo.
  try {
    const res = await fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      // Confirmación OK. Ahora hacer signIn automáticamente para no pedirle
      // al usuario que vuelva a tipear email+password.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        return {
          error:
            "Cuenta creada y confirmada. Ingresá con tu email y contraseña para entrar.",
        };
      }
      return { error: null };
    }
    const body = await res.json().catch(() => ({}));
    return {
      error:
        body.error ||
        "Cuenta creada pero no se pudo confirmar automáticamente. Intentá entrar con tu email y contraseña.",
    };
  } catch {
    return {
      error:
        "Cuenta creada. Intentá entrar con tu email y contraseña.",
    };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}
