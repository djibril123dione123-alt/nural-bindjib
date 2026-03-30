import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"guide" | "guardian">("guide");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
    } else {
      if (!displayName.trim()) {
        toast.error("Entrez votre prénom");
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, displayName, role);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Vérifiez votre e-mail pour confirmer votre inscription !");
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display font-bold text-gradient-emerald">
            Nur al-BinDjib
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Sultan Engine V3 — L'Alliance
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 space-y-6 glow-border-emerald">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "signup"}
              initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-display font-semibold text-foreground text-center mb-6">
                {isLogin ? "Connexion" : "Rejoindre l'Alliance"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                        Prénom
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Djibril ou Binta"
                        className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                        Rôle dans l'Alliance
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setRole("guide")}
                          className={`rounded-lg p-3 text-center transition-all ${
                            role === "guide"
                              ? "bg-primary/20 border-2 border-primary glow-emerald"
                              : "bg-secondary/50 border border-border"
                          }`}
                        >
                          <span className="text-2xl block mb-1">🧭</span>
                          <span className="text-xs font-semibold text-foreground">Le Guide</span>
                          <span className="text-[10px] block text-muted-foreground">Djibril</span>
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setRole("guardian")}
                          className={`rounded-lg p-3 text-center transition-all ${
                            role === "guardian"
                              ? "bg-accent/20 border-2 border-accent glow-gold"
                              : "bg-secondary/50 border border-border"
                          }`}
                        >
                          <span className="text-2xl block mb-1">🛡️</span>
                          <span className="text-xs font-semibold text-foreground">La Gardienne</span>
                          <span className="text-[10px] block text-muted-foreground">Binta</span>
                        </motion.button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileTap={{ scale: 0.97 }}
                  className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-lg py-3 text-sm transition-opacity disabled:opacity-50"
                >
                  {submitting
                    ? "..."
                    : isLogin
                    ? "Entrer dans l'Alliance"
                    : "Créer mon compte"}
                </motion.button>
              </form>
            </motion.div>
          </AnimatePresence>

          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin
                ? "Pas encore de compte ? Rejoindre l'Alliance"
                : "Déjà membre ? Se connecter"}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50">
          La constance {">"} la motivation
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
