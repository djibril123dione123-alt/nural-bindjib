import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useDuoPresence, type DuoStatus } from "@/hooks/useDuoPresence";
import { TodoList } from "@/components/TodoList";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: DuoStatus; label: string; emoji: string }[] = [
  { value: "libre", label: "Libre", emoji: "🟢" },
  { value: "occupe", label: "Occupé", emoji: "🔴" },
  { value: "endormi", label: "Endormi", emoji: "🌙" },
  { value: "etudie", label: "Étudie", emoji: "📚" },
];

export default function ProfileContent() {
  const { user, profile, signOut } = useAuth();
  const { myStatus, setMyStatus } = useDuoPresence();
  const [copied, setCopied] = useState(false);

  const roleLabel = profile?.role === "guide" ? "🧭 Le Guide" : "🛡️ La Gardienne";
  const roleDesc = profile?.role === "guide" ? "Djibril" : "Binta";
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true); toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Impossible de copier"); }
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald">
        <div className="text-5xl">{profile?.avatar_emoji || "🌙"}</div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">{profile?.display_name || "Utilisateur"}</h2>
          <p className="text-sm text-primary font-semibold">{roleLabel}</p>
          <p className="text-xs text-muted-foreground">{roleDesc}</p>
        </div>
        <div className="text-xs text-muted-foreground">{user?.email}</div>

        {/* Status selector */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mon Statut</p>
          <div className="flex items-center justify-center gap-2">
            {STATUS_OPTIONS.map(opt => (
              <motion.button
                key={opt.value}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMyStatus(opt.value)}
                className={`text-[10px] px-3 py-1.5 rounded-full border transition-all ${
                  myStatus === opt.value
                    ? "bg-primary/20 border-primary text-primary"
                    : "border-border/50 text-muted-foreground hover:border-primary/30"
                }`}
              >
                {opt.emoji} {opt.label}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-5 space-y-3 glow-border-gold">
        <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">💍 Inviter le partenaire</h3>
        <p className="text-xs text-muted-foreground">{profile?.role === "guide" ? "Envoie ce lien à Binta." : "Envoie ce lien à Djibril."}</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground truncate">{inviteLink}</div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={copyInvite}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${copied ? "bg-primary/20 border border-primary text-primary" : "bg-accent/20 border border-accent text-accent"}`}>
            {copied ? "✓ Copié" : "Copier"}
          </motion.button>
        </div>
      </motion.div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">📋 Tâches</h3>
        <TodoList showPartner />
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={signOut}
        className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
        Se déconnecter
      </motion.button>
    </div>
  );
}
