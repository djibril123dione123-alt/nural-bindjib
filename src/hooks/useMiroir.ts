// =============================================================================
// src/hooks/useMiroir.ts
// Sprint 1 — Pilier 1.3 : Démantèlement du monolithe MiroirAlliance
//
// Ce hook contient TOUTE la logique data du Miroir :
//   - Chargement des profils, tâches, salat, XP, activité
//   - Détection de Level Up en temps réel
//   - Réaltime Supabase (profiles, user_tasks, salat_tracking, activity_feed)
//   - Envoi d'encouragement (via database.service)
//
// MiroirAlliance.tsx devient un composant UI pur qui consomme ce hook.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { calculateLevel } from "@/lib/questData";
import {
  sendEncouragement as dbSendEncouragement,
} from "@/services/database.service";
import { toast } from "sonner";

// ─── Types exports (utilisés par les composants UI) ──────────────────────────

export interface MiroirProfile {
  id: string;              // PK = auth.uid() (aligné post-migration)
  display_name: string;
  role: string;
  total_xp: number;
  level: number;
  avatar_emoji: string;
}

export interface DailyPillarState {
  userId: string;
  xp: number;              // XP journalier (issu de daily_progress en priorité)
  pillars: {
    body:  boolean;        // 3+ tâches "body" complétées
    mind:  boolean;        // 2+ tâches "mind" complétées
    faith: boolean;        // 5 prières complétées
    life:  boolean;        // 2+ tâches "life" complétées
  };
}

export interface ActivityItem {
  id: string;
  user_id: string;
  actor_id?: string;
  action: string;
  xp_earned: number;
  created_at: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const DAILY_TARGET = 150;

// Seuils de validation des piliers
const PILLAR_THRESHOLDS = {
  body:  3,
  mind:  2,
  faith: 5, // prières
  life:  2,
} as const;

export function useMiroir() {
  const { user, profile } = useAuth();

  const [profiles, setProfiles]       = useState<MiroirProfile[]>([]);
  const [dailyState, setDailyState]   = useState<DailyPillarState[]>([]);
  const [activity, setActivity]       = useState<ActivityItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [bothComplete, setBothComplete] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);

  // Ref pour détecter les level-up sans re-render inutile
  const prevLevels = useRef<Record<string, number>>({});

  const today = new Date().toISOString().slice(0, 10);

  // ── Chargement principal ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!user?.id) return;

    // ── 1. Profils ─────────────────────────────────────────────────────────
    const { data: profsRaw } = await supabase
      .from("profiles")
      .select("id, display_name, role, total_xp, level, avatar_emoji");

    const profs: MiroirProfile[] = (profsRaw ?? []).map((p: any) => ({
      id:           p.id,
      display_name: p.display_name,
      role:         p.role,
      total_xp:     p.total_xp  ?? 0,
      level:        p.level     ?? calculateLevel(p.total_xp ?? 0),
      avatar_emoji: p.avatar_emoji ?? (p.role === "guide" ? "🧭" : "🛡️"),
    }));

    setProfiles(profs);

    // Initialiser les niveaux de référence (pour détecter level-up)
    profs.forEach(p => {
      if (!prevLevels.current[p.id]) {
        prevLevels.current[p.id] = p.level;
      }
    });

    // ── 2. Tâches du jour ──────────────────────────────────────────────────
    const { data: tasksData } = await supabase
      .from("user_tasks")
      .select("user_id, pillar, completed")
      .eq("date", today)
      .eq("completed", true);

    // ── 3. Salat du jour ───────────────────────────────────────────────────
    const { data: salatData } = await supabase
      .from("salat_tracking")
      .select("user_id, prayer_name, completed")
      .eq("date", today)
      .eq("completed", true);

    // ── 4. XP journalier (daily_progress, source de vérité XP) ────────────
    const { data: progData } = await supabase
      .from("daily_progress")
      .select("user_id, daily_xp")
      .eq("date", today);

    // ── 5. Calcul état des piliers par profil ──────────────────────────────
    const dailies: DailyPillarState[] = profs.map(p => {
      const tasks = (tasksData ?? []).filter((t: any) => t.user_id === p.id);
      const salat = (salatData ?? []).filter((s: any) => s.user_id === p.id);
      const prog  = (progData  ?? []).find((d: any) => d.user_id === p.id);

      const tasksByPillar = (pillar: string) =>
        tasks.filter((t: any) => t.pillar === pillar).length;

      // XP depuis daily_progress en priorité, sinon estimation
      const xp = prog?.daily_xp
        ?? (tasks.length * 10 + salat.length * 10);

      return {
        userId: p.id,
        xp,
        pillars: {
          body:  tasksByPillar("body")  >= PILLAR_THRESHOLDS.body,
          mind:  tasksByPillar("mind")  >= PILLAR_THRESHOLDS.mind,
          faith: salat.length           >= PILLAR_THRESHOLDS.faith,
          life:  tasksByPillar("life")  >= PILLAR_THRESHOLDS.life,
        },
      };
    });

    setDailyState(dailies);

    // Bonus Synergie : les deux ont 5/5 prières
    const bothDone =
      profs.length >= 2 &&
      profs.every(p =>
        (salatData ?? []).filter((s: any) => s.user_id === p.id).length >=
        PILLAR_THRESHOLDS.faith,
      );
    setBothComplete(bothDone);

    // ── 6. Activity feed du jour (dédupliqué) ─────────────────────────────
    const { data: actData } = await supabase
      .from("activity_feed")
      .select("id, user_id, actor_id, action, xp_earned, created_at")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (actData) {
      const seen = new Set<string>();
      const deduped = (actData as ActivityItem[]).filter(item => {
        // Utilise actor_id en priorité, user_id en fallback
        const ownerId = item.actor_id ?? item.user_id;
        const key = `${ownerId}-${item.action}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setActivity(deduped.slice(0, 12));
    }

    setLoading(false);
  }, [user?.id, today]);

  // ── Chargement initial ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    loadAll();
  }, [user?.id, loadAll]);

  // ── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("miroir-realtime")
      // Level Up : détection en temps réel sur profiles
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: any) => {
          const updated = payload.new;
          // Vérifier si c'est le profil de l'utilisateur connecté
          if (updated?.id === user.id) {
            const newLevel = updated.level ?? calculateLevel(updated.total_xp ?? 0);
            const oldLevel = prevLevels.current[updated.id] ?? 0;
            if (newLevel > oldLevel && oldLevel > 0) {
              setLevelUpLevel(newLevel);
            }
            prevLevels.current[updated.id] = newLevel;
          }
          loadAll();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tasks" },
        () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "salat_tracking" },
        () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_feed" },
        () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_progress" },
        () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadAll]);

  // ── Action : encouragement ──────────────────────────────────────────────
  const sendEncouragement = useCallback(async () => {
    if (!user?.id || !profile?.role) return;

    const { error } = await dbSendEncouragement(user.id, profile.role);
    if (error) {
      toast.error("Erreur d'envoi", { description: error.message });
      return;
    }

    toast.success("Message d'encouragement envoyé ✨");
    // Pas besoin de recharger : le realtime activity_feed va déclencher loadAll
  }, [user?.id, profile?.role]);

  // ── Helpers calculés ────────────────────────────────────────────────────
  const me      = profiles.find(p => p.id === user?.id);
  const partner = profiles.find(p => p.id !== user?.id);

  const dismissLevelUp = useCallback(() => setLevelUpLevel(null), []);

  return {
    // Données
    me,
    partner,
    profiles,
    dailyState,
    activity,
    // États UI
    loading,
    bothComplete,
    levelUpLevel,
    dailyTarget: DAILY_TARGET,
    // Actions
    sendEncouragement,
    dismissLevelUp,
    refresh: loadAll,
  };
}
