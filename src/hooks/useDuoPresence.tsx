import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DuoStatus = "libre" | "occupe" | "endormi" | "etudie";

interface PresenceState {
  partnerOnline: boolean;
  partnerName: string;
  /** Autre profil (alliance) — requis pour duo_messages.receiver_id côté DB. */
  partnerUserId: string | null;
  partnerStatus: DuoStatus;
  streakCount: number;
  myStatus: DuoStatus;
}

type DuoPresenceContextValue = PresenceState & {
  recordStreak: (prayerName: string) => Promise<void>;
  setMyStatus: (newStatus: DuoStatus) => Promise<void>;
};

const DuoPresenceContext = createContext<DuoPresenceContextValue | null>(null);

/**
 * Un seul abonnement Realtime « sanctuary-presence » pour toute l’app.
 * Plusieurs hooks sur le même nom de canal réutilisent le canal déjà souscrit
 * et déclenchent : « cannot add presence callbacks after subscribe() ».
 */
export function DuoPresenceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [state, setState] = useState<PresenceState>({
    partnerOnline: false,
    partnerName: "",
    partnerUserId: null,
    partnerStatus: "libre",
    streakCount: 0,
    myStatus: "libre",
  });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const statusRef = useRef<DuoStatus>("libre");

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel("sanctuary-presence", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    const handleSync = () => {
      const presenceState = channel.presenceState();
      let found = false;
      for (const [key, values] of Object.entries(presenceState)) {
        if (key !== user.id && Array.isArray(values) && values.length > 0) {
          const p = values[0] as { status?: DuoStatus };
          setState((prev) => ({
            ...prev,
            partnerOnline: true,
            partnerStatus: p.status || "libre",
          }));
          found = true;
          break;
        }
      }
      if (!found) setState((prev) => ({ ...prev, partnerOnline: false }));
    };

    // Tous les .on('presence', …) doivent être enregistrés AVANT .subscribe()
    channel.on("presence", { event: "sync" }, handleSync);
    channel.subscribe(async (subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
          status: statusRef.current,
          display_name: profile.display_name,
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, profile]);

  const setMyStatus = useCallback(
    async (newStatus: DuoStatus) => {
      statusRef.current = newStatus;
      setState((prev) => ({ ...prev, myStatus: newStatus }));
      const ch = channelRef.current;
      if (ch && user && profile) {
        try {
          await ch.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            status: newStatus,
            display_name: profile.display_name,
          });
        } catch (e) {
          console.warn("Status update failed:", e);
        }
      }
    },
    [user, profile],
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, display_name")
      .neq("id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setState((prev) => ({
            ...prev,
            partnerUserId: data.id,
            partnerName: data.display_name ?? "",
          }));
        }
      });
  }, [user]);

  const loadStreak = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("duo_streaks")
      .select("prayer_name, user_id")
      .eq("date", today);

    if (!data) return;
    const byPrayer: Record<string, Set<string>> = {};
    data.forEach((r: { prayer_name: string; user_id: string }) => {
      if (!byPrayer[r.prayer_name]) byPrayer[r.prayer_name] = new Set();
      byPrayer[r.prayer_name].add(r.user_id);
    });
    const syncCount = Object.values(byPrayer).filter((s) => s.size >= 2).length;
    setState((prev) => ({ ...prev, streakCount: syncCount }));
  }, [user]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  useEffect(() => {
    const channel = supabase
      .channel("duo-streaks-sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "duo_streaks" },
        () => loadStreak(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadStreak]);

  const recordStreak = useCallback(
    async (prayerName: string) => {
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      await supabase.from("duo_streaks").upsert(
        {
          prayer_name: prayerName,
          date: today,
          user_id: user.id,
          validated_at: now,
        },
        { onConflict: "user_id,prayer_name,date" },
      );
    },
    [user],
  );

  const value: DuoPresenceContextValue = {
    ...state,
    recordStreak,
    setMyStatus,
  };

  return (
    <DuoPresenceContext.Provider value={value}>{children}</DuoPresenceContext.Provider>
  );
}

export function useDuoPresence() {
  const ctx = useContext(DuoPresenceContext);
  if (!ctx) {
    throw new Error("useDuoPresence must be used within DuoPresenceProvider");
  }
  return ctx;
}
