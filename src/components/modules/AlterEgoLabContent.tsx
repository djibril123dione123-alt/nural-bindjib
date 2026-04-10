// =============================================================================
// src/components/modules/AlterEgoLabContent.tsx
// Sprint 1 — Migré vers database.service.createMission / completeMission
// =============================================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import {
  createMission as dbCreateMission,
  completeMission as dbCompleteMission,
} from "@/services/database.service";
import { toast } from "sonner";

interface Mission {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  description: string;
  xp: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export default function AlterEgoLabContent() {
  const { user } = useAuth();
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [partnerName, setPartnerName] = useState("Partenaire");
  const [partnerId, setPartnerId]     = useState<string | null>(null);
  const [title, setTitle]             = useState("");
  const [desc, setDesc]               = useState("");
  const [xp, setXp]                   = useState(20);
  const [tab, setTab]                 = useState<"received" | "sent">("received");
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPartner();
    loadMissions();

    const channel = supabase
      .channel("missions-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "alter_ego_missions",
      }, () => loadMissions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Lecture ──────────────────────────────────────────────────────────────
  const loadPartner = async () => {
    if (!user) return;
    // Recherche le partenaire par id ≠ user.id (aligné post-migration)
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();
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

  // ── Écriture via database.service ────────────────────────────────────────

  const createMission = async () => {
    if (!user || !partnerId || !title.trim() || loading) return;
    setLoading(true);

    const { error } = await dbCreateMission({
      from_user_id: user.id,
      to_user_id:   partnerId,
      title:        title.trim(),
      description:  desc.trim(),
      xp,
    });

    setLoading(false);

    if (error) {
      toast.error("Erreur de création", { description: error.message });
      return;
    }

    setTitle("");
    setDesc("");
    setXp(20);
    toast.success("Mission envoyée ! ⚔️");
    loadMissions();
  };

  const completeMission = async (mission: Mission) => {
    if (!user || loading) return;
    setLoading(true);

    const { error } = await dbCompleteMission(
      mission.id,
      user.id,
      mission.title,
      mission.xp,
    );

    setLoading(false);

    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }

    toast.success(`+${mission.xp} XP — Mission accomplie ! 🎉`);
    loadMissions();
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  const received = missions.filter(m => m.to_user_id === user?.id);
  const sent     = missions.filter(m => m.from_user_id === user?.id);
  const displayed = tab === "received" ? received : sent;

  return (
    <div className="space-y-5">
      {/* Formulaire création */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-primary">
          Mission pour {partnerName}
        </h3>
        <Input
          placeholder="Titre..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="bg-secondary/50 border-border"
        />
        <Input
          placeholder="Consigne (optionnel)..."
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="bg-secondary/50 border-border"
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">XP :</label>
          <Input
            type="number"
            value={xp}
            onChange={e => setXp(Number(e.target.value))}
            className="w-20 bg-secondary/50 border-border"
            min={5}
            max={100}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={createMission}
            disabled={!title.trim() || !partnerId || loading}
            className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            {loading ? "..." : "Envoyer ⚔️"}
          </motion.button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        {(["received", "sent"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "glass text-muted-foreground"
            }`}
          >
            {t === "received"
              ? `📥 Reçues (${received.length})`
              : `📤 Envoyées (${sent.length})`}
          </button>
        ))}
      </div>

      {/* Liste des missions */}
      <AnimatePresence mode="popLayout">
        {displayed.map(m => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className={`glass rounded-xl p-4 space-y-2 ${
              m.status === "completed" ? "opacity-60" : ""
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm text-foreground">{m.title}</p>
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {m.description}
                  </p>
                )}
              </div>
              <span className="text-xs font-bold text-accent">+{m.xp} XP</span>
            </div>

            {m.status === "pending" && tab === "received" && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => completeMission(m)}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold disabled:opacity-40"
              >
                ✅ Fait
              </motion.button>
            )}
            {m.status === "completed" && (
              <p className="text-xs text-primary">✅ Accomplie</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {displayed.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Aucune mission pour l'instant.
        </p>
      )}
    </div>
  );
}
