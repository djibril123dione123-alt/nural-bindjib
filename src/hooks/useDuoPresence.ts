import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DuoStatus = "libre" | "occupe" | "endormi" | "etudie";

interface PresenceState {
  partnerOnline: boolean;
  partnerName: string;
  partnerStatus: DuoStatus;
  streakCount: number;
  myStatus: DuoStatus;
}

export function useDuoPresence() {
  const { user, profile } = useAuth();
  const [state, setState] = useState<PresenceState>({
    partnerOnline: false,
    partnerName: "",
    partnerStatus: "libre",
    streakCount: 0,
    myStatus: "libre",
  });

  // Presence tracking with status
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("sanctuary-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        // Find partner presence
        for (const [key, values] of Object.entries(presenceState)) {
          if (key !== user.id && Array.isArray(values) && values.length > 0) {
            const partnerPresence = values[0] as any;
            setState(prev => ({
              ...prev,
              partnerOnline: true,
              partnerStatus: partnerPresence.status || "libre",
            }));
            return;
          }
        }
        setState(prev => ({ ...prev, partnerOnline: false }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            status: state.myStatus,
            display_name: profile?.display_name || "",
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  // Update status
  const setMyStatus = useCallback(async (newStatus: DuoStatus) => {
    setState(prev => ({ ...prev, myStatus: newStatus }));
    // Re-track with new status
    const channel = supabase.channel("sanctuary-presence");
    await channel.track({
      user_id: user?.id,
      online_at: new Date().toISOString(),
      status: newStatus,
      display_name: profile?.display_name || "",
    });
  }, [user, profile]);

  // Load partner name
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .neq("user_id", user.id)
        .limit(1)
        .single();
      if (data) setState(prev => ({ ...prev, partnerName: data.display_name }));
    };
    load();
  }, [user]);

  // Streak count
  const loadStreak = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("duo_streaks")
      .select("prayer_name, user_id")
      .eq("date", today);

    if (!data) return;

    const byPrayer: Record<string, Set<string>> = {};
    data.forEach((r: any) => {
      if (!byPrayer[r.prayer_name]) byPrayer[r.prayer_name] = new Set();
      byPrayer[r.prayer_name].add(r.user_id);
    });

    const syncCount = Object.values(byPrayer).filter(s => s.size >= 2).length;
    setState(prev => ({ ...prev, streakCount: syncCount }));
  }, [user]);

  useEffect(() => { loadStreak(); }, [loadStreak]);

  // Realtime streak updates
  useEffect(() => {
    const channel = supabase
      .channel("duo-streaks-sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "duo_streaks" }, () => {
        loadStreak();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadStreak]);

  // Record validation for streak
  const recordStreak = useCallback(async (prayerName: string) => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("duo_streaks").upsert(
      { prayer_name: prayerName, date: today, user_id: user.id },
      { onConflict: "user_id,prayer_name,date" }
    );
  }, [user]);

  return { ...state, recordStreak, setMyStatus };
}
