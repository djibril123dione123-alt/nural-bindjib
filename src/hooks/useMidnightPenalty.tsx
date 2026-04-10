// ============================================================
// useMidnightPenalty.tsx — Discipline de Fer (Version Build-Safe)
// ============================================================

import React, { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PILLARS = ["body", "mind", "faith", "life"] as const;
const PENALTY_PER_PILLAR = 30;

const PILLAR_LABELS: Record<string, string> = {
  body:  "Corps ⚔️",
  mind:  "Esprit 📚",
  faith: "Foi 🕌",
  life:  "Vie 🏠",
};

function msUntilDakarMidnight(): number {
  const now = new Date();
  const msPassedToday =
    (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000
    + now.getUTCMilliseconds();
  return 24 * 60 * 60 * 1000 - msPassedToday;
}

export function useMidnightPenalty() {
  const { user } = useAuth();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ranTodayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const schedule = () => {
      const ms = msUntilDakarMidnight();
      console.log(`[MidnightPenalty] Prochaine vérif dans ${Math.round(ms / 60000)} min`);

      timerRef.current = setTimeout(async () => {
        const todayStr = new Date().toISOString().slice(0, 10);

        if (ranTodayRef.current === todayStr) {
          schedule();
          return;
        }
        ranTodayRef.current = todayStr;

        await runPenalty(user.id);
        schedule();
      }, ms);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [user?.id]);
}

async function runPenalty(userId: string) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const [{ data: tasks }, { data: salat }] = await Promise.all([
    supabase.from("user_tasks").select("pillar")
      .eq("user_id", userId).eq("date", dateStr).eq("completed", true),
    supabase.from("salat_tracking").select("prayer_name")
      .eq("user_id", userId).eq("date", dateStr).eq("completed", true),
  ]);

  const donePillars = new Set<string>();
  (tasks ?? []).forEach((t: any) => { if (t.pillar) donePillars.add(t.pillar); });
  if ((salat ?? []).length > 0) donePillars.add("faith");

  const emptyPillars = PILLARS.filter((p) => !donePillars.has(p));

  if (emptyPillars.length === 0) {
    console.log("[MidnightPenalty] Journée parfaite — aucune pénalité !");
    await archiveDay(userId, dateStr, 0, donePillars, true);
    return;
  }

  const totalPenalty = emptyPillars.length * PENALTY_PER_PILLAR;

  const { data: newXpData, error } = await supabase.rpc("remove_xp", {
    p_user_id: userId,
    p_amount:  totalPenalty,
    p_source:  "midnight_penalty",
  });

  if (error) {
    console.error("[MidnightPenalty] Erreur RPC remove_xp :", error);
    return;
  }

  const row = Array.isArray(newXpData) ? newXpData[0] : newXpData;
  const newXp = row?.new_xp;
  if (typeof newXp !== "number") {
    console.error("[MidnightPenalty] remove_xp: réponse invalide", newXpData);
    return;
  }
  const pillarList = emptyPillars.map((p) => PILLAR_LABELS[p]).join(", ");

  await supabase.from("activity_feed").insert({
    actor_id: userId,
    user_id: userId,
    event_type: "penalty",
    action: `⚠️ Discipline de Fer : ${pillarList} non accomplis (-${totalPenalty} XP)`,
    xp_earned: -totalPenalty,
  });

  await archiveDay(userId, dateStr, newXp, donePillars, false);

  toast.error(`⚠️ Discipline de Fer : -${totalPenalty} XP`, {
    duration: 10000,
    description: `Piliers manquants : ${pillarList}`,
  });

  // Remplacement de sendNotification (éviter ENOENT build error)
  console.log(`[DISCIPLINE] -${totalPenalty} XP pour : ${pillarList}`);
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

  await supabase.from("alliance_history").upsert(
    { user_id: userId, date, daily_xp: dailyXp, pillars_completed: pillarsObj, perfect_day: perfectDay },
    { onConflict: "user_id,date" }
  ).then(({ error }) => {
    if (error) console.warn("[MidnightPenalty] archiveDay error :", error.message);
  });
}

export function MidnightPenaltyGuard({ children }: { children: React.ReactNode }) {
  useMidnightPenalty();
  return <>{children}</>;
}
