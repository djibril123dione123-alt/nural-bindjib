import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { calculateLevel } from "@/lib/questData";
import { toast } from "sonner";
import { safeWrite } from "@/services/database.service";

export interface ProfileData {
  id: string;
  display_name: string;
  role: string;
  total_xp: number;
  level: number;
  avatar_emoji: string;
}

export interface DailyXp {
  userId: string;
  xp: number;
  pillars: Record<string, boolean>;
}

export function useMiroir() {
  const { user } = useAuth();
  const { partnerOnline, partnerStatus, streakCount } = useDuoPresence();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [dailyXp, setDailyXp] = useState<DailyXp[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bothComplete, setBothComplete] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const prevLevels = useRef<Record<string, number>>({});
  const today = new Date().toISOString().slice(0, 10);
  const dailyTarget = 150;

  const loadAll = useCallback(async () => {
    if (!user) return;
    const { data: profs } = await supabase.from("profiles").select("*");
    if (profs) {
      setProfiles(profs as ProfileData[]);
      profs.forEach((p: any) => {
        if (!prevLevels.current[p.id]) prevLevels.current[p.id] = p.level || calculateLevel(p.total_xp || 0);
      });
    }

    const { data: tasksData } = await supabase
      .from("user_tasks")
      .select("user_id, pillar, completed")
      .eq("date", today)
      .eq("completed", true);

    const { data: salatData } = await supabase
      .from("salat_tracking")
      .select("user_id, prayer_name, completed")
      .eq("date", today)
      .eq("completed", true);

    if (profs) {
      const dailies: DailyXp[] = (profs as any[]).map((p) => {
        const userTasks = (tasksData || []).filter((t: any) => t.user_id === p.id);
        const userSalat = (salatData || []).filter((s: any) => s.user_id === p.id);
        const bodyTasks = userTasks.filter((t: any) => t.pillar === "body");
        const mindTasks = userTasks.filter((t: any) => t.pillar === "mind");
        const lifeTasks = userTasks.filter((t: any) => t.pillar === "life");
        return {
          userId: p.id,
          xp: userTasks.length * 10 + userSalat.length * 10,
          pillars: {
            body: bodyTasks.length >= 3,
            mind: mindTasks.length >= 2,
            faith: userSalat.length >= 5,
            life: lifeTasks.length >= 2,
          },
        };
      });
      setDailyXp(dailies);

      const allDone = profs.length >= 2 && (profs as any[]).every((p) => {
        const count = (salatData || []).filter((s: any) => s.user_id === p.id).length;
        return count >= 5;
      });
      setBothComplete(allDone);
    }

    const { data: progData } = await supabase
      .from("daily_progress")
      .select("user_id, daily_xp")
      .eq("date", today);

    if (progData) {
      setDailyXp((prev) => prev.map((d) => {
        const prog = (progData as any[]).find((p) => p.user_id === d.userId);
        return prog ? { ...d, xp: prog.daily_xp || d.xp } : d;
      }));
    }

    const { data: actData } = await supabase
      .from("activity_feed")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (actData) {
      const seen = new Set<string>();
      const deduped = actData.filter((a: any) => {
        const key = `${a.actor_id}-${a.action}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setActivity(deduped.slice(0, 12));
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    loadAll();
    const channel = supabase
      .channel("miroir-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload: any) => {
        const updated = payload.new as ProfileData;
        if (updated?.id === user.id) {
          const newLevel = updated.level || calculateLevel(updated.total_xp || 0);
          const oldLevel = prevLevels.current[updated.id] || 0;
          if (newLevel > oldLevel && oldLevel > 0) setLevelUpLevel(newLevel);
          prevLevels.current[updated.id] = newLevel;
        }
        loadAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tasks" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "salat_tracking" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_feed" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_progress" }, () => loadAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadAll]);

  const sendEncouragement = useCallback(async () => {
    if (!user) return;
    const me = profiles.find((p) => p.id === user.id);
    const partner = profiles.find((p) => p.id !== user.id);
    if (!partner || !me) return;

    const message = me.role === "guide"
      ? "Djibril pense a toi et t'encourage pour ton Master !"
      : "Binta pense a toi et t'encourage !";

    try {
      await safeWrite(
        supabase.from("activity_feed").insert({
          actor_id: user.id,
          user_id: user.id,
          event_type: "social",
          event_label: "Message",
          action: `💌 ${message}`,
          xp_earned: 0,
        }),
        "activity_feed.encouragement",
      );
      toast.success("Message d'encouragement envoye");
    } catch (err: any) {
      toast.error("Encouragement non envoye", { description: err?.message });
    }
  }, [user, profiles]);

  const me = profiles.find((p) => p.id === user?.id);
  const partner = profiles.find((p) => p.id !== user?.id);

  return {
    loading,
    profiles,
    dailyXp,
    activity,
    bothComplete,
    levelUpLevel,
    setLevelUpLevel,
    me,
    partner,
    sendEncouragement,
    partnerOnline,
    partnerStatus,
    streakCount,
    dailyTarget,
  };
}
