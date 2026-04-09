import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { SkeletonScreen } from "@/components/SkeletonScreen";
import { TodoList } from "@/components/TodoList";
import { calculateLevel, getRank, getTitle, xpForLevel } from "@/lib/questData";
import { toast } from "sonner";

const Profile = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  if (loading) return <SkeletonScreen />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Session expiree...</p>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-pulse">🌙</div>
        <p className="text-muted-foreground text-sm font-display">Chargement du Sanctuaire...</p>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = profile;
  const totalXp = stats?.total_xp ?? 0;
  const level = stats?.level ?? calculateLevel(totalXp) ?? 1;
  const rank = getRank(level);
  const { title } = getTitle(level, (stats?.role as "guide" | "guardian") ?? "guide");

  const xpForCurrent = level > 1 ? xpForLevel(level - 1) : 0;
  const xpForNext = xpForLevel(level);
  const xpRange = Math.max(xpForNext - xpForCurrent, 1);
  const xpProgress = Math.min(100, Math.round(((totalXp - xpForCurrent) / xpRange) * 100));

  const roleLabel = stats?.role === "guide" ? "Le Guide" : "La Gardienne";
  const roleDesc = stats?.role === "guide" ? "Djibril" : "Binta";
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Lien copie !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <BackButton />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pt-16">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">Profil</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald"
        >
          <div className="text-5xl">{stats?.avatar_emoji ?? "🌙"}</div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{stats?.display_name ?? "Utilisateur"}</h2>
            <p className="text-sm text-primary font-semibold">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{roleDesc}</p>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Niveau</p>
                <p className="text-2xl font-display font-bold text-primary">{level}</p>
              </div>
              <div className="text-center">
                <p className="text-lg">{rank.emoji}</p>
                <p className="text-[10px] text-accent font-semibold">{rank.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">XP Total</p>
                <p className="text-2xl font-display font-bold text-accent">{totalXp}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Nv. {level}</span>
                <span>{xpProgress}% → Nv. {level + 1}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{ boxShadow: "0 0 8px rgba(16,185,129,0.4)" }}
                />
              </div>
            </div>
            <p className="text-[10px] text-accent italic">{title}</p>
          </div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 space-y-3 glow-border-gold"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
            Inviter le partenaire
          </h3>
          <p className="text-xs text-muted-foreground">
            {stats?.role === "guide" ? "Envoie ce lien a Binta." : "Envoie ce lien a Djibril."}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground truncate">
              {inviteLink}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={copyInvite}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied ? "bg-primary/20 border border-primary text-primary" : "bg-accent/20 border border-accent text-accent"
              }`}
            >
              {copied ? "Copie" : "Copier"}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">Taches</h3>
          <TodoList showPartner />
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={signOut}
          className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold"
        >
          Se deconnecter
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
