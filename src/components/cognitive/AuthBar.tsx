"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, LogOut, Loader2, CheckCircle2, UserPlus, LogIn } from "lucide-react";

interface Props {
  user: { email?: string } | null;
  onLogin: (email: string, password: string) => Promise<{ error: string | null }>;
  onRegister: (email: string, password: string) => Promise<{ error: string | null }>;
  onLogout: () => Promise<void>;
}

export function AuthBar({ user, onLogin, onRegister, onLogout }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-muted/40 border border-border/40 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="truncate text-muted-foreground">
            Sincronizando como <span className="text-foreground font-medium">{user.email}</span>
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onLogout}
          className="h-7 px-2 text-xs"
        >
          <LogOut className="w-3 h-3 mr-1" />
          Salir
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const result =
      mode === "login"
        ? await onLogin(email.trim(), password)
        : await onRegister(email.trim(), password);
    setBusy(false);
    if (result.error) {
      // Si es registro y llegó info de "revisá tu email", mostrarlo como info no error
      if (mode === "register" && result.error.includes("revisá tu email")) {
        setInfo(result.error);
        setError(null);
      } else {
        setError(result.error);
      }
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 text-sm pl-8"
            disabled={busy}
            autoComplete="email"
          />
        </div>
        <div className="relative">
          <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            placeholder="contraseña (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 text-sm pl-8"
            disabled={busy}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={busy || !email.trim() || password.length < 6}
            className="h-9 flex-1"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="w-3.5 h-3.5 mr-1" />
            ) : (
              <UserPlus className="w-3.5 h-3.5 mr-1" />
            )}
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setInfo(null);
          }}
          className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
        >
          {mode === "login"
            ? "¿No tenés cuenta? Crear una"
            : "¿Ya tenés cuenta? Entrar"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}
      {info && (
        <p className="text-xs text-emerald-400 px-1">{info}</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Tu progreso se sincroniza entre dispositivos con la misma cuenta.
      </p>
    </div>
  );
}
