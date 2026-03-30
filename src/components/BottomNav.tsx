import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", icon: "⚔️", label: "Quêtes" },
  { path: "/deep-work", icon: "🎯", label: "Focus" },
  { path: "/chat", icon: "💬", label: "Duo" },
  { path: "/profile", icon: "👤", label: "Profil" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="glass border-t border-border">
        <div className="max-w-2xl mx-auto flex">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 w-12 h-0.5 bg-primary rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
