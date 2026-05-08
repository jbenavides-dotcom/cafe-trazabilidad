import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
})

/** Indica si Supabase está configurado (vars existen). No garantiza conectividad. */
export const supabaseConfigured = Boolean(url && anonKey)
