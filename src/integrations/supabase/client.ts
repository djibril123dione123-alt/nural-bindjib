import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Variables publiques Vite uniquement (préfixe VITE_). Clé anon = prévue pour le navigateur ;
// ne jamais exposer la service_role dans le bundle client.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Log de sécurité en développement uniquement
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Erreur de configuration Supabase : Vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont bien définies dans Vercel."
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "", 
  SUPABASE_PUBLISHABLE_KEY || "", 
  {
    db: {
      schema: "public",
    },
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
