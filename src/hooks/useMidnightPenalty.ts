// ============================================================
// useMidnightPenalty.ts — Discipline de Fer
// Vérifie à minuit heure de Dakar si un pilier est vide
// Applique -30 XP par pilier vide + log dans activity_feed
// À appeler dans Index.tsx ou App.tsx (une seule fois)
// ============================================================

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Dakar est UTC+0 (pas de DST). Minuit Dakar = 00:00 UTC
function getMsUntilDakarMidnight(): number {
  const now = new Date();
  // Dakar = UTC+0
  const dakarNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Dakar" }));
  const tomorrow = new Date(dakarNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - dakarNow.getTime();
}

const PILLARS = ["body", "mind", "faith", "life"] as const;
const PILLAR_LABELS: Record<string, string> = {
  body: "Corps ⚔️",
  mind: "Esprit 📚",
  faith: "Foi 🕌",
  life: "Vie 🏠",
};

export function useMidnightPenalty() {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const schedulePenaltyCheck = () => {
      const msUntilMidnight = getMsUntilDakarMidnight();
      console.log(`[MidnightPenalty] Prochaine vérification dans ${Math.round(msUntilMidnight / 60000)} min`);

      timerRef.current = setTimeout(async () => {
        await runPenaltyCheck();
        // Re-scheduler pour minuit suivant
        schedulePenaltyCheck();
      }, msUntilMidnight);
    };

    schedulePenaltyCheck();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user]);
}

async function runPenaltyCheck() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Charger les tâches du jour écoulé
  const { data: tasks } = await supabase
    .from("user_tasks")
    .select("pillar, completed")
    .eq("user_id", user.id)
    .eq("date", dateStr)
    .eq("completed", true);

  const { data: salat } = await supabase
    .from("salat_tracking")
    .select("prayer_name, completed")
    .eq("user_id", user.id)
    .eq("date", dateStr)
    .eq("completed", true);

  const completedPillars = new Set<string>();

  if (tasks) {
    tasks.forEach(t => {
      if (t.pillar) completedPillars.add(t.pillar);
    });
  }
  if (salat && salat.length > 0) {
    completedPillars.add("faith");
  }

  // Identifier les piliers vides
  const emptyPillars = PILLARS.filter(p => !completedPillars.has(p));

  if (emptyPillars.length === 0) {
    console.log("[MidnightPenalty] Tous les piliers complétés — aucune pénalité !");
    return;
  }

  const totalPenalty = emptyPillars.length * 30;

  // Appliquer la pénalité via SQL function
  const { data: penaltyResult } = await supabase
    .rpc("remove_xp", {
      p_user_id: user.id,
      p_amount: totalPenalty,
      p_source: "midnight_penalty",
    });

  // Logger dans activity_feed
  const pillarList = emptyPillars.map(p => PILLAR_LABELS[p]).join(", ");
  await supabase.from("activity_feed").insert({
    user_id: user.id,
    action: `⚠️ Pénalité Discipline : ${pillarList} non accomplis (-${totalPenalty} XP)`,
    xp_earned: -totalPenalty,
  });

  console.log(`[MidnightPenalty] Pénalité appliquée : -${totalPenalty} XP pour piliers : ${pillarList}`);

  // Notification toast (si l'app est ouverte à minuit)
  toast.error(
    `⚠️ Discipline de Fer : -${totalPenalty} XP\nPiliers manquants : ${pillarList}`,
    { duration: 8000 }
  );
}

// ============================================================
// Composant wrapper pour utiliser dans App.tsx ou Index.tsx
// ============================================================
export function MidnightPenaltyGuard({ children }: { children: React.ReactNode }) {
  useMidnightPenalty();
  return <>{children}</>;
}

// ============================================================
// INSTRUCTIONS D'INTÉGRATION
// ============================================================
// 1. Dans App.tsx, importer MidnightPenaltyGuard :
//    import { MidnightPenaltyGuard } from "@/components/MidnightPenaltyGuard";
//
// 2. Wrapper dans AuthProvider :
//    <AuthProvider>
//      <MidnightPenaltyGuard>
//        <AudioEngineProvider>
//          <AnimatedRoutes />
//        </AudioEngineProvider>
//      </MidnightPenaltyGuard>
//    </AuthProvider>
//
// 3. Vérifier que la fonction remove_xp existe dans Supabase
//    (définie dans supabase_migration_level_fix.sql)
// ============================================================
