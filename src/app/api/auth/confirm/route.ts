import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Lista blanca de emails autorizados a registrarse.
 * Cualquier otro email recibe 403 y el usuario no se crea.
 *
 * Para agregar un email nuevo, editá este array y hacé deploy.
 */
const ALLOWED_EMAILS = [
  "javiermendieta.contacto@gmail.com",
].map((e) => e.toLowerCase());

/**
 * Confirma automáticamente el email de un usuario recién registrado.
 * Llamado server-side justo después del signUp() para evitar que el
 * usuario tenga que hacer click en el email de confirmación.
 *
 * Esto soluciona el caso típico de Supabase free tier donde el SMTP
 * integrado tiene rate limits severos (~3-4 emails/hora) y los emails
 * pueden tardar o no llegar.
 *
 * Seguridad: requiere SUPABASE_SERVICE_ROLE_KEY (server-only, nunca
 * expuesta al cliente). Solo confirma usuarios que se acaban de
 * registrar con email+password válido Y están en la lista blanca.
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "email inválido" }, { status: 400 });
    }

    // Lista blanca — si no está, rechazar
    if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
      return NextResponse.json(
        { error: "Este email no está autorizado para usar la app." },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase no configurado server-side" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Buscar el usuario por email y confirmarlo
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }

    // Si ya está confirmado, no hacer nada
    if (user.email_confirmed_at) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, confirmed: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error desconocido" },
      { status: 500 }
    );
  }
}
