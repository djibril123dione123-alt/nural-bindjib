import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { getLevel } from "@/lib/questData";

const Profile = () => {
  const { user, profile, signOut } = useAuth();

  const roleLabel = profile?.role === "guide" ? "🧭 Le Guide" : "🛡️ La Gardienne";
  const roleDesc = profile?.role === "guide" ? "Djibril" : "Binta";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            👤 Profil
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 text-center space-y-4 glow-border-emerald"
        >
          <div className="text-5xl">{profile?.avatar_emoji || "🌙"}</div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">
              {profile?.display_name || "Utilisateur"}
            </h2>
            <p className="text-sm text-primary font-semibold">{roleLabel}</p>
            <p className="text-xs text-muted-foreground">{roleDesc}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {user?.email}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
            Alliance
          </h3>
          <p className="text-xs text-muted-foreground">
            L'Alliance entre Djibril et Binta est le cœur du Sultan Engine.
            Synchronisez vos progrès et élevez-vous ensemble.
          </p>
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={signOut}
          className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold"
        >
          Se déconnecter
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
