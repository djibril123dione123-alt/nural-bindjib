import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Mission {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  description: string;
  xp: number;
  status: string;
  proof_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function AlterEgoLab() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [partnerName, setPartnerName] = useState("Partenaire");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [xp, setXp] = useState(20);
  const [tab, setTab] = useState<"received" | "sent">("received");

  useEffect(() => {
    if (!user) return;
    loadPartner();
    loadMissions();

    const channel = supabase
      .channel("missions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alter_ego_missions" }, () => {
        loadMissions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadPartner = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").neq("id", user.id).limit(1).single();
    if (data) {
      setPartnerName(data.display_name);
      setPartnerId(data.id);
    }
  };

  const loadMissions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("alter_ego_missions")
      .select("*")
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (data) setMissions(data as Mission[]);
  };

  const createMission = async () => {
    if (!user || !partnerId || !title.trim()) return;
    await supabase.from("alter_ego_missions").insert({
      from_user_id: user.id,
      to_user_id: partnerId,
      title: title.trim(),
      description: desc.trim(),
      xp,
    });
    setTitle("");
    setDesc("");
    setXp(20);
    toast.success("Mission envoyée ! ⚔️");
  };

  const completeMission = async (mission: Mission) => {
    await supabase.from("alter_ego_missions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", mission.id);

    // Log activity
    if (user) {
      await supabase.from("activity_feed").insert({
        actor_id: user.id,
        action: `a terminé la mission "${mission.title}"`,
        xp_earned: mission.xp,
      });
    }
    toast.success(`+${mission.xp} XP — Mission accomplie ! 🎉`);
  };

  const received = missions.filter(m => m.to_user_id === user?.id);
  const sent = missions.filter(m => m.from_user_id === user?.id);
  const displayed = tab === "received" ? received : sent;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🪞 Laboratoire des Alter Egos</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Missions croisées — Confiance totale</p>
        </motion.div>

        {/* Create mission */}
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Créer une mission pour {partnerName}</h3>
          <Input placeholder="Titre de la mission..." value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary/50 border-border" />
          <Input placeholder="Consigne (optionnel)..." value={desc} onChange={e => setDesc(e.target.value)} className="bg-secondary/50 border-border" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">XP :</label>
            <Input type="number" value={xp} onChange={e => setXp(Number(e.target.value))} className="w-20 bg-secondary/50 border-border" min={5} max={100} />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={createMission}
              disabled={!title.trim() || !partnerId}
              className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
            >
              Envoyer ⚔️
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["received", "sent"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              {t === "received" ? `📥 Reçues (${received.length})` : `📤 Envoyées (${sent.length})`}
            </button>
          ))}
        </div>

        {/* Mission list */}
        <AnimatePresence mode="popLayout">
          {displayed.map(m => (
            <motion.div key={m.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }}
              className={`glass rounded-xl p-4 space-y-2 ${m.status === "completed" ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm text-foreground">{m.title}</p>
                  {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                </div>
                <span className="text-xs font-bold text-accent">+{m.xp} XP</span>
              </div>
              {m.status === "pending" && tab === "received" && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => completeMission(m)}
                  className="w-full py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors"
                >
                  ✅ Marquer comme fait
                </motion.button>
              )}
              {m.status === "completed" && (
                <p className="text-xs text-primary">✅ Accomplie</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {displayed.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Aucune mission {tab === "received" ? "reçue" : "envoyée"} pour l'instant.</p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
