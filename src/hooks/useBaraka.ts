import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { applyXpDelta } from "@/lib/xpRpc";

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
    const value = entry[role];
    return Number.isFinite(value) ? value : 10;
  }, [role]);

  const awardXp = useCallback(async (amount: number, source: string) => {
    if (!user) return;
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount)) {
      toast.error("Erreur XP", { description: "Montant XP invalide (undefined/NaN)." });
      return;
    }

    const res = await applyXpDelta(user.id, safeAmount, source).catch((e: any) => {
      toast.error("Erreur XP", { description: e?.message ?? "add_xp échoué" });
      return null;
    });
    if (!res) return;
    const newTotal = res.new_xp;

    if (navigator.vibrate) navigator.vibrate(50);
    return newTotal;
  }, [user]);

  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user) return;
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount)) {
      toast.error("Erreur XP", { description: "Montant XP invalide (undefined/NaN)." });
      return;
    }

    const res = await applyXpDelta(user.id, -safeAmount, reason).catch((e: any) => {
      toast.error("Erreur XP", { description: e?.message ?? "remove_xp échoué" });
      return null;
    });
    if (!res) return;
    const newTotal = res.new_xp;

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    return newTotal;
  }, [user]);

  return { getXp, awardXp, applyPenalty, role };
}
