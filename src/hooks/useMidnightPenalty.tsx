// ============================================================
// useMidnightPenalty.ts — Discipline de Fer
//
// Vérifie à 00h00 heure de Dakar (UTC+0) si des piliers
// sont vides. Applique -30 XP par pilier manquant via
// remove_xp() RPC — atomique, sans conflit avec useQuestEngine.
//
// Archive dans alliance_history avant la remise à zéro.
// ============================================================

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { toast } from "sonner";

const PILLARS = ["body", "mind", "faith", "life"] as const;
const PENALTY_PER_PILLAR = 30;

const PILLAR_LABELS: Record<string, string> = {
  body:  "Corps ⚔️",
  mind:  "Esprit 📚",
  faith: "Foi 🕌",
  life:  "Vie 🏠",
};

// Dakar = UTC+0 (pas de DST)
function msUntilDakarMidnight(): number {
  const now = new Date();
  // On calcule l'heure Dakar = UTC+0 directement
  const utcHours   = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcMs      = now.getUTCMilliseconds();

  const msPassedToday = (utcHours * 3600 + utcMinutes * 60 + utcSeconds) * 1000 + utcMs;
  const msInDay = 24 * 60 * 60 * 1000;
  return msInDay - msPassedToday;
}

export function useMidnightPenalty() {
  const { user } = useAuth();
  const { sendNotification } = useServiceWorker();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ranTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const schedule = () => {
      const ms = msUntilDakarMidnight();
      console.log(`[MidnightPenalty] Prochaine vérif dans ${Math.round(ms / 60000)} min`);

      timerRef.current = setTimeout(async () => {
        const todayStr = new Date().toISOString().slice(0, 10);

        // Guard : n'exécuter qu'une fois par journée
        if (ranTodayRef.current === todayStr) {
          schedule();
          return;
        }
        ranTodayRef.current = todayStr;

        await runPenalty(user.id, sendNotification);
        schedule();
      }, ms);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [user?.id]);
}

async function runPenalty(
  userId: string,
  sendNotification: (title: string, body: string, opts?: any) => void
) {
  // La date "hier" côté Dakar = la journée qui vient de se terminer
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Lire les tâches complétées d'hier
  const [{ data: tasks }, { data: salat }, { data: prof }] = await Promise.all([
    supabase.from("user_tasks").select("pillar")
      .eq("user_id", userId).eq("date", dateStr).eq("completed", true),
    supabase.from("salat_tracking").select("prayer_name")
      .eq("user_id", userId).eq("date", dateStr).eq("completed", true),
    supabase.from("profiles").select("total_xp,level").eq("user_id", userId).single(),
  ]);

  const donePillars = new Set<string>();
  (tasks ?? []).forEach((t: any) => { if (t.pillar) donePillars.add(t.pillar); });
  if ((salat ?? []).length > 0) donePillars.add("faith");

  const emptyPillars = PILLARS.filter((p) => !donePillars.has(p));
  const totalPenalty = emptyPillars.length * PENALTY_PER_PILLAR;

  // Pas de pénalité si tous les piliers ont été touchés
  if (emptyPillars.length === 0) {
    console.log("[MidnightPenalty] Journée parfaite — aucune pénalité !");

    // Archiver dans alliance_history
    await archiveDay(userId, dateStr, prof?.total_xp ?? 0, donePillars, true);
    return;
  }

  // ── Appliquer la pénalité via RPC atomique ──────────────
  const { data: newXpData, error } = await supabase.rpc("remove_xp", {
    p_user_id: userId,
    p_amount: totalPenalty,
    p_source: "midnight_penalty",
  });

  if (error) {
    console.error("[MidnightPenalty] Erreur RPC :", error);
    return;
  }

  const pillarList = emptyPillars.map((p) => PILLAR_LABELS[p]).join(", ");
  const newXp = newXpData ?? (prof?.total_xp ?? 0) - totalPenalty;

  // ── Log activity_feed ───────────────────────────────────
  await supabase.from("activity_feed").insert({
    user_id: userId,
    action: `⚠️ Discipline de Fer : ${pillarList} non accomplis (-${totalPenalty} XP)`,
    xp_earned: -totalPenalty,
  });

  // ── Archiver la journée ─────────────────────────────────
  await archiveDay(userId, dateStr, newXp, donePillars, false);

  // ── Toast si l'app est ouverte ──────────────────────────
  toast.error(
    `⚠️ Discipline de Fer\n-${totalPenalty} XP\nPiliers manquants : ${pillarList}`,
    {
      duration: 10000,
      description: `${emptyPillars.length} pilier${emptyPillars.length > 1 ? "s" : ""} négligé${emptyPillars.length > 1 ? "s" : ""}`,
    }
  );

  // ── Notification push (même si app fermée) ───────────────
  sendNotification(
    "⚠️ Discipline de Fer — Pénalité",
    `-${totalPenalty} XP : ${pillarList} non accomplis hier.`,
    { tag: "midnight-penalty", url: "/", type: "penalty" }
  );

  console.log(`[MidnightPenalty] -${totalPenalty} XP → Nouveau total : ${newXp}`);
}

async function archiveDay(
  userId: string,
  date: string,
  dailyXp: number,
  donePillars: Set<string>,
  perfectDay: boolean
) {
  const pillarsObj: Record<string, boolean> = {};
  PILLARS.forEach((p) => { pillarsObj[p] = donePillars.has(p); });

  await supabase.from("alliance_history").upsert(
    {
      user_id: userId,
      date,
      daily_xp: dailyXp,
      pillars_completed: pillarsObj,
      perfect_day: perfectDay,
    },
    { onConflict: "user_id,date" }
  );
}

// ── Composant wrapper pour App.tsx ───────────────────────────
export function MidnightPenaltyGuard({ children }: { children: React.ReactNode }) {
  useMidnightPenalty();
  return <>{children}</>;
}
