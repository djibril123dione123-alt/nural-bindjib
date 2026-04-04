import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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

export function useSanctuaryTime() {
  const { user } = useAuth();
  const [times, setTimes] = useState<Record<string, string>>({});
  const [now, setNow] = useState(new Date());

  // Load times from DB
  const loadTimes = useCallback(async () => {
    const { data } = await supabase
      .from("sanctuary_settings")
      .select("prayer_name, custom_time");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.prayer_name] = r.custom_time; });
      setTimes(map);
    }
  }, []);

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
    await supabase
      .from("sanctuary_settings")
      .update({ custom_time: newTime, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("prayer_name", prayerKey);
  }, [user]);

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

  return { prayers, times, updateTime, atmosphere, nextPrayer, now };
}
