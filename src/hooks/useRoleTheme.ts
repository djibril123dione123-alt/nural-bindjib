import { useEffect } from "react";
import { useAuth } from "./useAuth";

export function useRoleTheme() {
  const { profile } = useAuth();
  const role = profile?.role || "guide";

  useEffect(() => {
    const root = document.documentElement;
    if (role === "guardian") {
      // Rose Quartz aura
      root.style.setProperty("--primary", "330 71% 71%");       // #F472B6
      root.style.setProperty("--primary-foreground", "0 0% 0%");
      root.style.setProperty("--ring", "330 71% 71%");
      root.style.setProperty("--emerald", "330 71% 71%");
      root.style.setProperty("--glow-emerald", "0 0 20px rgba(244, 114, 182, 0.4)");
    } else {
      // Bleu Royal aura
      root.style.setProperty("--primary", "217 91% 60%");       // #3B82F6
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--ring", "217 91% 60%");
      root.style.setProperty("--emerald", "217 91% 60%");
      root.style.setProperty("--glow-emerald", "0 0 20px rgba(59, 130, 246, 0.4)");
    }

    return () => {
      // Reset on unmount (optional)
    };
  }, [role]);

  return role;
}
