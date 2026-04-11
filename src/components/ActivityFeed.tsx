import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth"; 

interface FeedItem {
  id: string;
  actor_id: string;
  action: string;
  xp_earned: number;
  created_at: string;
}

export function ActivityFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; role: string }>>({});

  useEffect(() => {
    loadFeed();
    loadProfiles();

    const channel = supabase
      .channel("activity-feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, () => {
        loadFeed();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadFeed = async () => {
    const { data } = await supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      // Deduplicate: keep only latest per user+action combo
      const seen = new Set<string>();
      const deduped = (data as FeedItem[]).filter(item => {
        const key = `${item.actor_id}-${item.action}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(deduped.slice(0, 8));
    }
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, display_name, role");
    if (data) {
      const map: Record<string, { name: string; role: string }> = {};
      data.forEach(p => { map[p.id] = { name: p.display_name, role: p.role }; });
      setProfiles(map);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  };

  if (items.length === 0) return null;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-display font-semibold text-accent flex items-center gap-2">
        🪞 Miroir de l'Alliance
      </h3>
      <AnimatePresence mode="popLayout">
        {items.map(item => {
          const isMe = item.actor_id === user?.id;
          const profile = profiles[item.actor_id];
          const name = profile?.name || "...";
          const emoji = profile?.role === "guardian" ? "🛡️" : "🧭";
          return (
            <motion.div key={item.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 text-xs ${isMe ? "text-primary" : "text-accent"}`}
            >
              <span className="text-base">{emoji}</span>
              <span className="flex-1 text-foreground/80 truncate">
                <strong>{name}</strong> {item.action}
              </span>
              {item.xp_earned > 0 && <span className="text-accent text-[10px]">+{item.xp_earned}</span>}
              <span className="text-muted-foreground text-[10px]">{timeAgo(item.created_at)}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
