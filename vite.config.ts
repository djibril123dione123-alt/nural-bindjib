// vite.config.ts
// ✅ FIX PWA : vite-plugin-pwa gère le manifest du service worker
//    et injecte automatiquement tous les assets hashés dans le précache
// npm i -D vite-plugin-pwa  ← à exécuter avant le build

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  plugins: [
    react(),

    // ── VitePWA ───────────────────────────────────────────────
    // Génère /sw.js en mode "injectManifest" pour utiliser notre
    // sw.js personnalisé (Adhan, notifications, etc.)
    VitePWA({
      // "injectManifest" : on garde notre sw.js custom,
      // VitePWA injecte juste la liste des assets précachés dedans
      strategies: "injectManifest",

      // Chemin de notre Service Worker source
      srcDir: ".",
      filename: "sw.js",

      // Dossier de sortie du SW compilé (même que Vite build output)
      outDir: "dist",

      // Ne pas générer de manifest.json (on a le nôtre)
      manifest: false,

      // Activer en mode dev pour tester
      devOptions: {
        enabled: mode === "development",
        type: "module",
      },

      injectManifest: {
        // Variable injectée dans sw.js avec la liste précachée
        injectionPoint: undefined,   // on ne l'utilise pas, on cache à la demande
        rollupFormat: "iife",

        // Tous les assets Vite (JS, CSS, fonts locales) sont précachés
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}",
        ],

        // Exclure les sourcemaps
        globIgnores: ["**/*.map"],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    // Optimisation chunking pour Vercel (évite les fichiers > 500 ko)
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":   ["react", "react-dom", "react-router-dom"],
          "vendor-ui":      ["framer-motion", "@radix-ui/react-dialog", "sonner"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts":  ["recharts"],
        },
      },
    },
  },
}));
