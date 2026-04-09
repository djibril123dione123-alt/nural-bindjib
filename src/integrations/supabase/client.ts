// On essaie de récupérer la clé sous les deux noms possibles pour être sûr
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Vérification de sécurité pour ne pas avoir de page noire
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("ERREUR : Les clés Supabase ne sont pas détectées dans l'environnement.");
}
