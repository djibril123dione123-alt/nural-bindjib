import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Prayer name mapping (Wolof/Arabic → standard)
export const PRAYER_GRID = [
  { key: "fajr", label: "Fajr", wolof: "Fajr", icon: "🌅", atmosphere: "warm" as const },
  { key: "suba", label: "Suba", wolof: "Suba", icon: "☀️", atmosphere: "bright" as const },
  { key: "dhuhr", label: "Tisbaar", wolof: "Tisbaar", icon: "🌤️", atmosphere: "bright" as const },
  { key: "asr", label: "Takussan", wolof: "Takussan", icon: "🌇", atmosphere: "bright" as const },
  { key: "maghrib", label: "Timis", wolof: "Timis", icon: "🌆", atmosphere: "sunset" as const },
  { key: "isha", label: "Gué", wolof: "Gué", icon: "🌙", atmosphere: "deep" as const },
] as const;

export type PrayerAtmosphere = "warm" | "bright" | "sunset" | "deep";

export interface PrayerTimeEntry {
  key: string;
  label: string;
  wolof: string;
  icon: string;
  atmosphere: PrayerAtmosphere;
  time: string;
  isUnlocked: boolean;
  isNext: boolean;
  minutesUntil: number;
  isPast: boolean;
}

const DEFAULT_PRAYER_TIMES: Record<string, string> = {
  fajr: "05:42",
  suba: "05:57",
  dhuhr: "14:15",
  asr: "17:00",
  maghrib: "19:31",
  isha: "20:31",
};

async function trySavePrayerTime(prayerKey: string, newTime: string, userId: string) {
  const stamp = new Date().toISOString();

  const attempts = [
    async () =>
      supabase
        .from("sanctuary_settings")
        .upsert(
          {
            user_id: userId,
            prayer_name: prayerKey,
            custom_time: newTime,
            updated_by: userId,
            updated_at: stamp,
          },
          { onConflict: "user_id,prayer_name" },
        ),
    async () =>
      supabase
        .from("sanctuary_settings")
        .upsert(
          {
            user_id: userId,
            prayer_name: prayerKey,
            custom_time: newTime,
            updated_by: "00000000-0000-0000-0000-000000000000",
            updated_at: stamp,
          },
          { onConflict: "user_id,prayer_name" },
        ),
    // Compat anciens schémas sans user_id / index composite.
    async () =>
      supabase
        .from("sanctuary_settings")
        .upsert(
          {
            prayer_name: prayerKey,
            custom_time: newTime,
            updated_by: userId,
            updated_at: stamp,
          },
          { onConflict: "prayer_name" },
        ),
    async () =>
      supabase
        .from("sanctuary_settings")
        .update({
          custom_time: newTime,
          updated_by: userId,
          updated_at: stamp,
        })
        .eq("prayer_name", prayerKey),
    async () =>
      supabase
        .from("sanctuary_settings")
        .insert({
          prayer_name: prayerKey,
          custom_time: newTime,
          updated_by: userId,
          updated_at: stamp,
        }),
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    const { error } = await attempt();
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}

export function useSanctuaryTime() {
  const { user } = useAuth();
  const [times, setTimes] = useState<Record<string, string>>(DEFAULT_PRAYER_TIMES);
  const [now, setNow] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Load times from DB
  const loadTimes = useCallback(async () => {
    if (!user?.id) {
      setTimes(DEFAULT_PRAYER_TIMES);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let data: any[] | null = null;

    const firstTry = await supabase
      .from("sanctuary_settings")
      .select("prayer_name, custom_time")
      .eq("user_id", user.id);

    if (!firstTry.error && (firstTry.data?.length ?? 0) > 0) {
      data = firstTry.data ?? [];
    } else {
      // Compat schémas legacy : table sans user_id ou données globales par prayer_name.
      const fallback = await supabase
        .from("sanctuary_settings")
        .select("prayer_name, custom_time");
      if (!fallback.error) {
        data = fallback.data ?? [];
      } else {
        data = [];
      }
    }

    if (data && data.length > 0) {
      const map: Record<string, string> = { ...DEFAULT_PRAYER_TIMES };
      data.forEach((r: any) => {
        if (r?.prayer_name && r?.custom_time) map[r.prayer_name] = r.custom_time;
      });
      setTimes(map);
    } else {
      setTimes(DEFAULT_PRAYER_TIMES);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => { loadTimes(); }, [loadTimes]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("sanctuary-settings-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sanctuary_settings" }, () => {
        loadTimes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTimes]);

  // Clock tick every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Update a prayer time
  const updateTime = useCallback(async (prayerKey: string, newTime: string) => {
    if (!user) return;

    const error = await trySavePrayerTime(prayerKey, newTime, user.id);
    if (error) {
      toast.error("Erreur de connexion", {
        description: error.message || "Impossible d'enregistrer l'heure.",
      });
      return;
    }
    // Met à jour le state local seulement après confirmation DB.
    setTimes((prev) => ({ ...prev, [prayerKey]: newTime }));
    toast.success("Heure enregistrée");
  }, [user, loadTimes]);

  // Compute prayer states
  const prayers = useMemo((): PrayerTimeEntry[] => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let foundNext = false;

    return PRAYER_GRID.map(p => {
      const time = times[p.key] || "00:00";
      const [h, m] = time.split(":").map(Number);
      const prayerMinutes = h * 60 + m;
      const diff = prayerMinutes - nowMinutes;
      const isPast = diff < 0;
      const isUnlocked = diff <= 0;
      const isNext = !foundNext && diff > 0;
      if (isNext) foundNext = true;

      return {
        ...p,
        time,
        isUnlocked,
        isNext,
        minutesUntil: diff,
        isPast,
      };
    });
  }, [times, now]);

  // Current atmosphere based on time
  const atmosphere = useMemo((): PrayerAtmosphere => {
    const hour = now.getHours();
    if (hour >= 5 && hour < 7) return "warm";
    if (hour >= 7 && hour < 17) return "bright";
    if (hour >= 17 && hour < 20) return "sunset";
    return "deep";
  }, [now]);

  // Next prayer info
  const nextPrayer = useMemo(() => prayers.find(p => p.isNext) || null, [prayers]);

  return { prayers, times, updateTime, atmosphere, nextPrayer, now, isLoading };
}
