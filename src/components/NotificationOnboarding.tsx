import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServiceWorker } from "@/hooks/useServiceWorker";

export function NotificationOnboarding() {
  const [show, setShow] = useState(false);
  const { notifPermission, requestPermission, swRegistered } = useServiceWorker();

  useEffect(() => {
    // Afficher uniquement si la permission n'a pas encore été demandée
    const declined = localStorage.getItem("notif_declined") === "true";
    if (!declined && swRegistered && notifPermission === "default") {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [swRegistered, notifPermission]);

  const handleAccept = async () => {
    await requestPermission();
    setShow(false);
  };

  const handleDecline = () => {
    setShow(false);
    localStorage.setItem("notif_declined", "true");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-md bg-background border border-accent/30 rounded-2xl p-6 space-y-4"
            style={{ boxShadow: "0 0 40px rgba(245, 158, 11, 0.15)" }}
          >
            {/* Icône */}
            <div className="text-center space-y-2">
              <div className="text-5xl">🕌</div>
              <h2 className="text-lg font-display font-bold text-foreground">
                Activer l'Adhan
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pour recevoir l'appel à la prière à l'heure exacte, même quand l'application est fermée, activez les notifications.
              </p>
            </div>

            {/* Détails */}
            <div className="space-y-2">
              {[
                { icon: "🌅", text: "Adhan automatique aux 5 prières" },
                { icon: "⏰", text: "Rappel 20 min avant chaque prière" },
                { icon: "💌", text: "Messages de l'Alliance en temps réel" },
                { icon: "👑", text: "Notification Level Up instantanée" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-foreground/80">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Boutons */}
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDecline}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground text-sm font-semibold"
              >
                Plus tard
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAccept}
                className="flex-2 flex-grow py-3 rounded-xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, #10b981, #F59E0B)", color: "#000" }}
              >
                ✓ Activer l'Adhan
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
