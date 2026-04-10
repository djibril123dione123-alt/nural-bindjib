import { forwardRef } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "Accueil" },
  { path: "/tazkiyah", icon: "🕌", label: "Tazkiyah" },
  { path: "/focus", icon: "🎯", label: "Focus" },
  { path: "/reflexion", icon: "✍️", label: "Réflexion" },
  { path: "/synergie", icon: "♾️", label: "Synergie" },
];

export const BottomNav = forwardRef<HTMLDivElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-40">
      <div className="glass border-t border-border">
        <div className="max-w-2xl mx-auto flex">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(item.path)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] uppercase tracking-wider font-medium">
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 w-8 h-0.5 bg-primary rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

BottomNav.displayName = "BottomNav";
