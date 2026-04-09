// Profile.tsx — Crash-proof V5
// Enveloppe globale try/catch + tous les calculs null-safés

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { SkeletonScreen } from "@/components/SkeletonScreen";
import { TodoList } from "@/components/TodoList";
import { toast } from "sonner";

// Fonctions de calcul inline — pas d'import externe qui pourrait crasher
function safeCalculateLevel(xp: number): number {
  try {
    const lvl = Math.floor(Math.sqrt(Math.max(0, xp) / 50));
    return Math.max(1, Math.min(150, lvl));
  } catch { return 1; }
}

function safeGetRank(level: number) {
  if (level >= 91)  return { emoji: "💎", name: "Khalifa" };
  if (level >= 51)  return { emoji: "🥇", name: "Architecte" };
  if (level >= 21)  return { emoji: "🥈", name: "Sentinelle" };
  return               { emoji: "🥉", name: "Novice" };
}

// Composant ErrorBoundary inline
function ProfileError({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-4xl">⚠️</div>
      <p className="text-foreground font-bold">Erreur de rendu Profile</p>
      <div className="bg-secondary/50 rounded-xl p-4 max-w-md w-full">
        <p className="text-xs text-destructive font-mono break-all">{error}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
      >
        Recharger
      </button>
    </div>
  );
}

const Profile = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  // ── Debug log — à retirer après résolution ──
  console.log("[Profile] loading:", loading, "user:", user?.id, "profile:", profile);

  // Guards
  if (loading) return <SkeletonScreen />;
  if (!user)   return <ProfileError error="Pas de session utilisateur" />;
  if (!profile) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="text-4xl animate-pulse">🌙</div>
      <p className="text-muted-foreground text-sm">Chargement du Sanctuaire...</p>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Calculs entourés de try/catch individuel
  let totalXp = 0, level = 1, rank = safeGetRank(1), title = "Murid";
  let xpProgress = 0;

  try {
    totalXp = Math.max(0, profile.total_xp ?? 0);
    level   = profile.level ?? safeCalculateLevel(totalXp);
    rank    = safeGetRank(level);

    // Utilise la même formule que questData.ts : 50 * n²
    const xpForNext    = 50 * Math.pow(level + 1, 2);
    const xpForCurrent = 50 * Math.pow(level, 2);
    const xpRange      = Math.max(xpForNext - xpForCurrent, 1);
    xpProgress = Math.min(100, Math.max(0,
      Math.round(((totalXp - xpForCurrent) / xpRange) * 100)
    ));
    console.log("[Profile] xp calc:", { totalXp, level, xpForNext, xpForCurrent, xpProgress });
  } catch (e: any) {
    console.error("[Profile] Erreur calcul XP:", e);
    return <ProfileError error={`Calcul XP: ${e?.message}`} />;
  }

  const roleLabel  = profile.role === "guide" ? "🧭 Le Guide" : "🛡️ La Gardienne";
  const roleDesc   = profile.role === "guide" ? "Djibril" : "Binta";
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Impossible de copier"); }
  };

  // Rendu entouré d'un try/catch global
  try {
    return (
      <div className="min-h-screen bg-background pb-20">
        <BackButton />
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pt-16">

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-2xl font-display font-bold text-gradient-emerald">👤 Profil</h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald">
            <div className="text-5xl">{profile.avatar_emoji ?? "🌙"}</div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">
                {profile.display_name ?? "Utilisateur"}
              </h2>
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
                  />
                </div>
              </div>
              <p className="text-[10px] text-accent italic">{title}</p>
            </div>
            <div className="text-xs text-muted-foreground">{user.email ?? ""}</div>
          </motion.div>

          {/* Invite */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 space-y-3 glow-border-gold">
            <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
              💍 Inviter le partenaire
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground truncate">
                {inviteLink}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={copyInvite}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${copied ? "bg-primary/20 border border-primary text-primary" : "bg-accent/20 border border-accent text-accent"}`}>
                {copied ? "✓ Copié" : "Copier"}
              </motion.button>
            </div>
          </motion.div>

          {/* Tâches */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }} className="glass rounded-2xl p-5 space-y-3">
            <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
              📋 Tâches
            </h3>
            <TodoList showPartner />
          </motion.div>

          <motion.button whileTap={{ scale: 0.97 }} onClick={signOut}
            className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
            Se déconnecter
          </motion.button>
        </div>
        <BottomNav />
      </div>
    );
  } catch (e: any) {
    console.error("[Profile] Erreur rendu JSX:", e);
    return <ProfileError error={`Rendu JSX: ${e?.message}`} />;
  }
};

export default Profile;
