# Cognitive Training App

Sistema de entrenamiento cognitivo de 10 min/día, 5 días a la semana.

Basado en el diagnóstico inicial del usuario, cada día golpea un punto ciego distinto:
- **Lunes** — Buffer de trabajo (suma mental, cadenas, N-back)
- **Martes** — Cálculo cotidiano (vueltos, % invertido, multiplicación)
- **Miércoles** — Retención bajo fricción (lectura densa + preguntas)
- **Jueves** — Multitarea y fronteras semánticas
- **Viernes** — Velocidad bajo presión (20 cálculos cronometrados)

## Stack

- Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- Supabase (auth + base de datos para sync entre dispositivos)
- localStorage como fallback offline

## Deploy

### 1. Supabase

1. Crear proyecto en https://supabase.com
2. Ir a **SQL Editor** → **New Query**
3. Pegar el contenido de `supabase-schema.sql` y ejecutar
4. Ir a **Project Settings → API**
5. Copiar `Project URL` y `anon public key`

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con los valores de Supabase
```

Para Vercel: agregar las mismas variables en **Project Settings → Environment Variables**.

### 3. Configurar Auth en Supabase

1. En Supabase: **Authentication → Providers → Email** → asegurarse de que esté habilitado
2. En **Authentication → URL Configuration**:
   - Site URL: tu URL de Vercel (ej: `https://tu-app.vercel.app`)
   - Redirect URLs: `https://tu-app.vercel.app/**`

### 4. Deploy en Vercel

**Opción A (recomendada): Conectar desde el dashboard**

1. Ir a https://vercel.com/new
2. Importar el repo `javiermendieta/cognitive-training`
3. En "Environment Variables", agregar:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://uycysrfcfolvdtbkrols.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (tu anon key de Supabase)
4. Click **Deploy**

**Opción B: Vercel CLI**

```bash
npm i -g vercel
vercel login
vercel --prod
# Cuando pregunte por env vars, agregar las dos de arriba
```

### 5. Production

La app usa magic link auth (sin contraseña). El usuario se loguea con email, recibe un link, y su progreso se sincroniza automáticamente con Supabase. Si no está logueado, los datos se guardan localmente en el navegador.

## Desarrollo

```bash
bun install
bun run dev
```

## Estructura

```
src/
├── lib/
│   ├── cognitive-engine.ts    # Generador de ejercicios (5 días)
│   ├── cognitive-storage.ts   # Storage layer (Supabase + localStorage)
│   └── supabase-client.ts     # Cliente Supabase browser
├── hooks/
│   └── useAuth.ts             # Hook de autenticación
├── components/cognitive/
│   ├── CognitiveApp.tsx       # Dashboard + navegación
│   ├── SessionPanel.tsx       # Runner de sesión + resumen
│   ├── ExerciseRunner.tsx     # UI de cada tipo de ejercicio
│   └── AuthBar.tsx            # Login/logout
└── app/
    ├── layout.tsx
    ├── page.tsx
    └── globals.css
```

## Notas

- El plan se basa en el diagnóstico del usuario (evaluación de 3 bloques: retención, cálculo, multitarea).
- Re-evaluación recomendada a las 8 semanas.
