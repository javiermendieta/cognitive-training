"use client";

import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut,
} from "@/lib/cognitive-storage";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    // Import dinámico para evitar crear cliente si no está configurado
    import("@/lib/supabase-client")
      .then(({ createClient }) => {
        const supabase = createClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        let mounted = true;

        supabase.auth.getUser().then(({ data: { user } }) => {
          if (mounted) {
            setUser(user);
            setLoading(false);
          }
        });

        const { data: sub } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (mounted) {
              setUser(session?.user ?? null);
              setLoading(false);
            }
          }
        );

        return () => {
          mounted = false;
          sub.subscription.unsubscribe();
        };
      })
      .catch(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      return signInWithEmail(email, password);
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      return signUpWithEmail(email, password);
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
