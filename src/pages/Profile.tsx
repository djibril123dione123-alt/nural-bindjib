// ============================================================
// Profile.tsx — Anti-crash V3 FINAL
//
// Fixes :
//   ✅ Triple guard : loading → !user → !profile
//   ✅ Toutes les valeurs null-safées (??  0, ?? "")
//   ✅ Formule XP correcte : Math.pow(level * 10, 2)
//   ✅ calculateLevel ne reçoit jamais undefined
//   ✅ SkeletonScreen pendant le chargement
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { SkeletonScreen } from "@/components/SkeletonScreen";
import { TodoList } from "@/components/TodoList";
import { calculateLevel, getRank, getTitle } from "@/lib/questData";
import { toast } from "sonner";

const Profile = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  // ── Guard 1 : Auth en cours de chargement ────────────────
  if (loading) return <SkeletonScreen />;

  // ── Guard 2 : Pas de session (ne devrait pas arriver via ProtectedRoute)
  if (!user) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground text-sm">Session expirée...</p>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Guard 3 : Profile Supabase pas encore arrivé (100–300 ms) ─
  if (!profile) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="text-4xl animate-pulse">🌙</div>
      <p className="text-muted-foreground text-sm font-display">Chargement du Sanctuaire...</p>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Valeurs null-safées à 100% ───────────────────────────
  const totalXp    = profile.total_xp ?? 0;              // ✅ jamais undefined
  const safeXp     = Math.max(0, totalXp);               // ✅ jamais négatif
  const level      = profile.level ?? calculateLevel(safeXp); // ✅ fallback

  const rank       = getRank(level);
  const { title }  = getTitle(level, (profile.role as "guide" | "guardian") ?? "guide");

  // ── Calcul progression vers le niveau suivant ────────────
  // Formule : XP(n) = (n × 10)²
  const xpForNext     = Math.pow(level * 10, 2);
  const xpForCurrent  = Math.pow(Math.max(0, level - 1) * 10, 2);
  const xpRange       = Math.max(xpForNext - xpForCurrent, 1);
  const xpProgress    = Math.min(100, Math.max(0,
    Math.round(((safeXp - xpForCurrent) / xpRange) * 100)
  ));

  const roleLabel  = profile.role === "guide" ? "🧭 Le Guide" : "🛡️ La Gardienne";
  const roleDesc   = profile.role === "guide" ? "Djibril" : "Binta";
  const partnerMsg = profile.role === "guide" ? "Envoie ce lien à Binta." : "Envoie ce lien à Djibril.";
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <BackButton />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pt-16">

        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">👤 Profil</h1>
        </motion.div>

        {/* Carte principale */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald"
        >
          <div className="text-5xl">{profile.avatar_emoji ?? "🌙"}</div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">
              {profile.display_name ?? "Utilisateur"}
            </h2>
            <p className="text-sm text-primary font-semibold">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{roleDesc}</p>
          </div>

          {/* XP / Niveau */}
          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Niveau</p>
                <p className="text-2xl font-display font-bold text-primary">{level}</p>
              </div>
              <div className="text-center">
                <p className="text-lg">{rank?.emoji ?? "⚔️"}</p>
                <p className="text-[10px] text-accent font-semibold">{rank?.name ?? "Guerrier"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">XP Total</p>
                <p className="text-2xl font-display font-bold text-accent">{safeXp}</p>
              </div>
            </div>

            {/* Barre de progression */}
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
            <p className="text-[10px] text-accent italic">{title ?? ""}</p>
          </div>

          <div className="text-xs text-muted-foreground">{user.email ?? ""}</div>
        </motion.div>

        {/* Invite partenaire */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 space-y-3 glow-border-gold"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
            💍 Inviter le partenaire
          </h3>
          <p className="text-xs text-muted-foreground">{partnerMsg}</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground truncate">
              {inviteLink}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }} onClick={copyInvite}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied
                  ? "bg-primary/20 border border-primary text-primary"
                  : "bg-accent/20 border border-accent text-accent"
              }`}
            >
              {copied ? "✓ Copié" : "Copier"}
            </motion.button>
          </div>
        </motion.div>

        {/* L'Alliance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
            ⚔️ L'Alliance
          </h3>
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

        {/* Tâches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider">
            📋 Tâches
          </h3>
          <TodoList showPartner />
        </motion.div>

        {/* Accès rapide */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass rounded-2xl p-4"
        >
          <h3 className="text-[10px] font-display font-bold text-foreground uppercase tracking-wider mb-3">
            🔗 Accès rapide
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: "/lab",       icon: "🧘", label: "Deep Work" },
              { href: "/reflexion", icon: "📝", label: "Journal" },
              { href: "/synergie",  icon: "💬", label: "Duo Chat" },
            ].map((l) => (
              <a key={l.href} href={l.href}
                className="glass rounded-xl p-3 text-center hover:bg-secondary/30 transition-colors"
              >
                <p className="text-xl">{l.icon}</p>
                <p className="text-[9px] text-muted-foreground mt-1">{l.label}</p>
              </a>
            ))}
          </div>
        </motion.div>

        {/* Déconnexion */}
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={signOut}
          className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold"
        >
          Se déconnecter
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
