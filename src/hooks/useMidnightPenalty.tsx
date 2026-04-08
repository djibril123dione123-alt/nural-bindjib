// ============================================================
// useMidnightPenalty.tsx — Discipline de Fer
// IMPORTANT : extension .tsx obligatoire (JSX dans le composant)
//
// Logique :
//   - Timer précis sur minuit UTC (= minuit Dakar, UTC+0)
//   - remove_xp() RPC atomique → zéro race condition avec useQuestEngine
//   - Archive dans alliance_history après chaque journée
//   - Push notification via service worker
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

// Dakar = UTC+0 — on calcule directement en UTC
function msUntilDakarMidnight(): number {
  const now = new Date();
  const msPassedToday =
    (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000
    + now.getUTCMilliseconds();
  return 24 * 60 * 60 * 1000 - msPassedToday;
}

export function useMidnightPenalty() {
  const { user } = useAuth();
  const { sendNotification } = useServiceWorker();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ranTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const schedule = () => {
      const ms = msUntilDakarMidnight();
      console.log(`[MidnightPenalty] Prochaine vérif dans ${Math.round(ms / 60000)} min`);

      timerRef.current = setTimeout(async () => {
        const todayStr = new Date().toISOString().slice(0, 10);

        // Guard idempotence : une seule exécution par jour
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

async function runPenalty(
  userId: string,
  sendNotification: (title: string, body: string, opts?: any) => void
) {
  // "Hier" = la journée qui vient de se clore
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

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

  // Journée parfaite — pas de pénalité, juste archiver
  if (emptyPillars.length === 0) {
    console.log("[MidnightPenalty] Journée parfaite — aucune pénalité !");
    await archiveDay(userId, dateStr, prof?.total_xp ?? 0, donePillars, true);
    return;
  }

  const totalPenalty = emptyPillars.length * PENALTY_PER_PILLAR;

  // ── remove_xp RPC — atomique, transactionnel ────────────
  const { data: newXpData, error } = await supabase.rpc("remove_xp", {
    p_user_id: userId,
    p_amount:  totalPenalty,
    p_source:  "midnight_penalty",
  });

  if (error) {
    console.error("[MidnightPenalty] Erreur RPC remove_xp :", error);
    return;
  }

  const newXp      = newXpData ?? Math.max(0, (prof?.total_xp ?? 0) - totalPenalty);
  const pillarList = emptyPillars.map((p) => PILLAR_LABELS[p]).join(", ");

  // ── Log dans activity_feed ──────────────────────────────
  await supabase.from("activity_feed").insert({
    user_id:   userId,
    action:    `⚠️ Discipline de Fer : ${pillarList} non accomplis (-${totalPenalty} XP)`,
    xp_earned: -totalPenalty,
  });

  // ── Archiver la journée ─────────────────────────────────
  await archiveDay(userId, dateStr, newXp, donePillars, false);

  // ── Toast visible si l'app est ouverte ─────────────────
  toast.error(`⚠️ Discipline de Fer : -${totalPenalty} XP`, {
    duration: 10000,
    description: `Piliers manquants : ${pillarList}`,
  });

  // ── Notification push (app fermée) ──────────────────────
  sendNotification(
    "⚠️ Discipline de Fer — Pénalité appliquée",
    `-${totalPenalty} XP : ${pillarList} non accomplis hier.`,
    { tag: "midnight-penalty", url: "/", type: "penalty" }
  );

  console.log(`[MidnightPenalty] -${totalPenalty} XP → Nouveau total : ${newXp}`);
}

async function archiveDay(
  userId:    string,
  date:      string,
  dailyXp:   number,
  donePillars: Set<string>,
  perfectDay:  boolean
) {
  const pillarsObj: Record<string, boolean> = {};
  PILLARS.forEach((p) => { pillarsObj[p] = donePillars.has(p); });

  // alliance_history peut ne pas exister encore — on ignore l'erreur silencieusement
  await supabase.from("alliance_history").upsert(
    { user_id: userId, date, daily_xp: dailyXp, pillars_completed: pillarsObj, perfect_day: perfectDay },
    { onConflict: "user_id,date" }
  ).then(({ error }) => {
    if (error) console.warn("[MidnightPenalty] alliance_history upsert :", error.message);
  });
}

// ── Wrapper pour App.tsx ─────────────────────────────────────
export function MidnightPenaltyGuard({ children }: { children: React.ReactNode }) {
  useMidnightPenalty();
  return <>{children}</>;
}
