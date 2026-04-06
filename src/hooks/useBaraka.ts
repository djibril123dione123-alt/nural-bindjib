import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Role-based XP multipliers
const XP_TABLE: Record<string, { guide: number; guardian: number }> = {
  fajr:      { guide: 10, guardian: 12 },
  suba:      { guide: 5,  guardian: 6 },
  dhuhr:     { guide: 5,  guardian: 6 },
  asr:       { guide: 5,  guardian: 6 },
  maghrib:   { guide: 5,  guardian: 6 },
  isha:      { guide: 5,  guardian: 6 },
  mosque:    { guide: 6,  guardian: 0 },
  hifz:      { guide: 2,  guardian: 2 },
  quran_pre: { guide: 15, guardian: 15 },
  tasbih:    { guide: 10, guardian: 10 },
  hijab:     { guide: 0,  guardian: 30 },
  no_music:  { guide: 30, guardian: 30 },
};

export function useBaraka() {
  const { user, profile } = useAuth();
  const role = (profile?.role || "guide") as "guide" | "guardian";

  const getXp = useCallback((activity: string): number => {
    const entry = XP_TABLE[activity];
    if (!entry) return 10;
    return entry[role];
  }, [role]);

  const awardXp = useCallback(async (amount: number, source: string) => {
    if (!user) return;

    // Log to xp_history
    await supabase.from("xp_history").insert({
      user_id: user.id,
      amount,
      source,
    });

    // Update profile total_xp (trigger auto-calculates level)
    const { data: prof } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("user_id", user.id)
      .single();

    const newTotal = (prof?.total_xp || 0) + amount;

    await supabase
      .from("profiles")
      .update({ total_xp: newTotal })
      .eq("user_id", user.id);

    // Log activity (clean source)
    await supabase.from("activity_feed").insert({
      user_id: user.id,
      action: source,
      xp_earned: amount,
    });

    if (navigator.vibrate) navigator.vibrate(50);
    return newTotal;
  }, [user]);

  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user) return;

    await supabase.from("xp_history").insert({
      user_id: user.id,
      amount: -amount,
      source: reason,
    });

    const { data: prof } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("user_id", user.id)
      .single();

    const newTotal = Math.max(0, (prof?.total_xp || 0) - amount);

    await supabase
      .from("profiles")
      .update({ total_xp: newTotal })
      .eq("user_id", user.id);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    return newTotal;
  }, [user]);

  return { getXp, awardXp, applyPenalty, role };
}
