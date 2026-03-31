import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { TodoList } from "@/components/TodoList";
import { toast } from "sonner";

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const roleLabel = profile?.role === "guide" ? "🧭 Le Guide" : "🛡️ La Gardienne";
  const roleDesc = profile?.role === "guide" ? "Djibril" : "Binta";

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Lien d'invitation copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Impossible de copier"); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">👤 Profil</h1>
        </motion.div>

        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald">
          <div className="text-5xl">{profile?.avatar_emoji || "🌙"}</div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{profile?.display_name || "Utilisateur"}</h2>
            <p className="text-sm text-primary font-semibold">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{roleDesc}</p>
          </div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </motion.div>

        {/* Invite */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 space-y-3 glow-border-gold">
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">💍 Inviter le partenaire</h3>
          <p className="text-xs text-muted-foreground">
            {profile?.role === "guide" ? "Envoie ce lien à Binta." : "Envoie ce lien à Djibril."}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground truncate">{inviteLink}</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={copyInvite}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied ? "bg-primary/20 border border-primary text-primary" : "bg-accent/20 border border-accent text-accent"
              }`}>
              {copied ? "✓ Copié" : "Copier"}
            </motion.button>
          </div>
        </motion.div>

        {/* Alliance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5 space-y-3">
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">⚔️ L'Alliance</h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-lg">🧭</p>
              <p className="text-xs text-foreground font-bold">Le Guide</p>
              <p className="text-[10px] text-muted-foreground">Mentor & Stratège</p>
            </div>
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-lg">🛡️</p>
              <p className="text-xs text-foreground font-bold">La Gardienne</p>
              <p className="text-[10px] text-muted-foreground">Force & Sagesse</p>
            </div>
          </div>
        </motion.div>

        {/* Tasks with partner view */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5 space-y-3">
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">📋 Tâches</h3>
          <TodoList showPartner />
        </motion.div>

        {/* Quick links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass rounded-2xl p-4">
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider mb-3">🔗 Accès rapide</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: "/deep-work", icon: "🧘", label: "Deep Work" },
              { href: "/journal", icon: "📝", label: "Journal" },
              { href: "/chat", icon: "💬", label: "Duo Chat" },
            ].map(l => (
              <a key={l.href} href={l.href}
                className="glass rounded-xl p-3 text-center hover:bg-secondary/30 transition-colors">
                <p className="text-xl">{l.icon}</p>
                <p className="text-[9px] text-muted-foreground mt-1">{l.label}</p>
              </a>
            ))}
          </div>
        </motion.div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={signOut}
          className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
          Se déconnecter
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
