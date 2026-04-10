// =============================================================================
// src/hooks/useSanctuaryTime.ts
// Sprint 1 — Pilier 1.2 : Global Citizen
//
// Avant : calculs basés sur new Date().getHours() → timezone du navigateur.
// Après : calculs basés sur la timezone du profil utilisateur via Intl API.
//         Un utilisateur à Montréal (UTC-5) verra Fajr à 05:42 heure de Dakar,
//         mais le countdown sera calculé dans SA timezone locale.
//
// Architecture :
//   - nowInUserTz()   → heure actuelle dans la timezone du profil
//   - prayerTzDate()  → construire une Date pour une heure HH:MM dans une timezone
//   - updateTime()    → délégue à database.service.savePrayerTime (safeWrite)
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { savePrayerTime } from "@/services/database.service";
import { toast } from "sonner";

// ─── Grille de prières ───────────────────────────────────────────────────────

export const PRAYER_GRID = [
  { key: "fajr",    label: "Fajr",     wolof: "Fajr",     icon: "🌅", atmosphere: "warm"   as const },
  { key: "suba",    label: "Suba",     wolof: "Suba",     icon: "☀️", atmosphere: "bright" as const },
  { key: "dhuhr",   label: "Tisbaar",  wolof: "Tisbaar",  icon: "🌤️", atmosphere: "bright" as const },
  { key: "asr",     label: "Takussan", wolof: "Takussan", icon: "🌇", atmosphere: "bright" as const },
  { key: "maghrib", label: "Timis",    wolof: "Timis",    icon: "🌆", atmosphere: "sunset" as const },
  { key: "isha",    label: "Gué",      wolof: "Gué",      icon: "🌙", atmosphere: "deep"   as const },
] as const;

export type PrayerKey = typeof PRAYER_GRID[number]["key"];
export type PrayerAtmosphere = "warm" | "bright" | "sunset" | "deep";

export interface PrayerTimeEntry {
  key: PrayerKey;
  label: string;
  wolof: string;
  icon: string;
  atmosphere: PrayerAtmosphere;
  time: string;          // HH:MM — heure de la prière dans la timezone de référence
  isUnlocked: boolean;
  isNext: boolean;
  minutesUntil: number;  // diff en minutes dans la timezone du profil
  isPast: boolean;
}

// ─── Horaires fallback (Dakar, Avril) ────────────────────────────────────────

const DEFAULT_TIMES: Record<string, string> = {
  fajr:    "05:42",
  suba:    "05:57",
  dhuhr:   "14:15",
  asr:     "17:00",
  maghrib: "19:31",
  isha:    "20:31",
};

// ─── Utilitaires Timezone ────────────────────────────────────────────────────

/**
 * Retourne les heures/minutes courantes dans une timezone donnée.
 * Utilise l'API Intl.DateTimeFormat — 100% navigateur, aucune dépendance.
 */
function getNowInTimezone(tz: string): { hours: number; minutes: number; date: Date } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hours   = parseInt(parts.find(p => p.type === "hour")?.value   ?? "0", 10);
    const minutes = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
    return { hours, minutes, date: now };
  } catch {
    // Timezone invalide → fallback locale
    const now = new Date();
    return { hours: now.getHours(), minutes: now.getMinutes(), date: now };
  }
}

/**
 * Retourne l'heure actuelle en minutes (0–1439) dans une timezone donnée.
 */
function nowMinutesInTz(tz: string): number {
  const { hours, minutes } = getNowInTimezone(tz);
  return hours * 60 + minutes;
}

/**
 * Détermine l'atmosphère (ambiance visuelle) selon l'heure dans la timezone.
 */
function getAtmosphere(tz: string): PrayerAtmosphere {
  const { hours } = getNowInTimezone(tz);
  if (hours >= 5  && hours < 7)  return "warm";
  if (hours >= 7  && hours < 17) return "bright";
  if (hours >= 17 && hours < 20) return "sunset";
  return "deep";
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSanctuaryTime() {
  const { user, profile } = useAuth();

  // timezone du profil — fallback Dakar si non défini
  const userTz = profile?.timezone ?? "Africa/Dakar";

  const [times, setTimes] = useState<Record<string, string>>(DEFAULT_TIMES);
  const [timesLoaded, setTimesLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  // ── Chargement des horaires depuis Supabase ─────────────────────────────
  const loadTimes = useCallback(async () => {
    // On charge en priorité les horaires de l'utilisateur connecté
    let query = supabase
      .from("sanctuary_settings")
      .select("prayer_name, custom_time");

    if (user?.id) {
      // Essayer d'abord les horaires personnels (schéma avec user_id)
      const { data: personal } = await supabase
        .from("sanctuary_settings")
        .select("prayer_name, custom_time")
        .eq("user_id", user.id);

      if (personal && personal.length > 0) {
        const map: Record<string, string> = { ...DEFAULT_TIMES };
        personal.forEach((r: any) => {
          if (r.prayer_name && r.custom_time) map[r.prayer_name] = r.custom_time;
        });
        setTimes(map);
        setTimesLoaded(true);
        return;
      }
    }

    // Fallback : horaires globaux (schéma legacy sans user_id)
    const { data } = await query;
    if (data && data.length > 0) {
      const map: Record<string, string> = { ...DEFAULT_TIMES };
      data.forEach((r: any) => {
        if (r.prayer_name && r.custom_time) map[r.prayer_name] = r.custom_time;
      });
      setTimes(map);
    }
    // Si rien en DB → DEFAULT_TIMES restent actifs
    setTimesLoaded(true);
  }, [user?.id]);

  useEffect(() => { loadTimes(); }, [loadTimes]);

  // ── Realtime sync des horaires ──────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("sanctuary-settings-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sanctuary_settings" },
        () => loadTimes(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTimes]);

  // ── Tick horloge toutes les 30 secondes ─────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Mise à jour d'une heure de prière ───────────────────────────────────
  // Délègue à database.service.savePrayerTime (safeWrite)
  const updateTime = useCallback(
    async (prayerKey: string, newTime: string): Promise<boolean> => {
      if (!user?.id) return false;

      // Optimistic update
      setTimes(prev => ({ ...prev, [prayerKey]: newTime }));

      const { error } = await savePrayerTime(user.id, prayerKey, newTime);

      if (error) {
        // Rollback
        setTimes(prev => ({ ...prev, [prayerKey]: times[prayerKey] }));
        toast.error("Impossible d'enregistrer l'heure", {
          description: error.message,
        });
        return false;
      }

      toast.success("Heure enregistrée ✓");
      return true;
    },
    [user?.id, times],
  );

  // ── Calcul des états des prières (timezone-aware) ───────────────────────
  const prayers = useMemo((): PrayerTimeEntry[] => {
    // Utilisation de la timezone du profil — plus de getHours() local
    const nowMins = nowMinutesInTz(userTz);
    let foundNext = false;

    return PRAYER_GRID.map(p => {
      const time = times[p.key] ?? DEFAULT_TIMES[p.key] ?? "00:00";
      const [h, m] = time.split(":").map(Number);
      const prayerMins = h * 60 + m;
      const diff       = prayerMins - nowMins;
      const isPast     = diff < -1;      // marge 1 min pour éviter le flash
      const isUnlocked = diff <= 0;
      const isNext     = !foundNext && diff > 0;
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
    // now est en dépendance pour forcer le recalcul à chaque tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, now, userTz]);

  // ── Atmosphère visuelle ─────────────────────────────────────────────────
  const atmosphere = useMemo(
    // Recalcule sur chaque tick et sur le changement de timezone
    () => getAtmosphere(userTz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, userTz],
  );

  // ── Prochaine prière ────────────────────────────────────────────────────
  const nextPrayer = useMemo(
    () => prayers.find(p => p.isNext) ?? null,
    [prayers],
  );

  return {
    prayers,
    times,
    timesLoaded,
    userTz,
    updateTime,
    atmosphere,
    nextPrayer,
    now,
  };
}
