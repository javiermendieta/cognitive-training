"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, LogOut, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  user: { email?: string } | null;
  onLogin: (email: string) => Promise<{ error: string | null }>;
  onLogout: () => Promise<void>;
}

export function AuthBar({ user, onLogin, onLogout }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const result = await onLogin(email.trim());
    setSending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-start gap-2 text-xs">
          <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-emerald-300 mb-0.5">Revisá tu email</div>
            <div className="text-muted-foreground">
              Te mandamos un link a <span className="font-mono">{email}</span>. Hacé clic desde cualquier dispositivo para entrar y sincronizar tu progreso.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 text-sm"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={sending || !email.trim()} className="h-9">
          {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Entrar
        </Button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-[10px] text-muted-foreground">
        Sin contraseña. Te mandamos un link mágico por email. Tu progreso se sincroniza entre dispositivos.
      </p>
    </div>
  );
}
