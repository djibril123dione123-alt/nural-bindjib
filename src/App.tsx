import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DuoPresenceProvider } from "@/hooks/useDuoPresence";
import { AudioEngineProvider } from "@/hooks/useAudioEngine";
import { AnimatePresence, motion } from "framer-motion";
import { SkeletonScreen } from "@/components/SkeletonScreen";
// ✅ FIX BUILD : import depuis .tsx (contient du JSX)
import { MidnightPenaltyGuard } from "@/hooks/useMidnightPenalty";
import { NotificationOnboarding } from "@/components/NotificationOnboarding";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import TazkiyahHub from "./pages/TazkiyahHub";
import LabHub from "./pages/LabHub";
import ReflexionHub from "./pages/ReflexionHub";
import SynergieHub from "./pages/SynergieHub";
import MiroirAlliance from "./pages/MiroirAlliance";
import DuoChat from "./pages/DuoChat";
import DeepWork from "./pages/DeepWork";
import JournalSakinah from "./pages/JournalSakinah";
import HifzTracker from "./pages/HifzTracker";
import SalatTracker from "./pages/SalatTracker";
import AlterEgoLab from "./pages/AlterEgoLab";
import BilanSoir from "./pages/BilanSoir";
import Tazkiyah from "./pages/Tazkiyah";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ─── ProtectedRoute — jamais de redirect pendant loading ─────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonScreen />;
  if (!user)   return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Onboarding notifs : uniquement utilisateur connecté (évite flash sur /auth). */
function NotificationOnboardingGate() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <NotificationOnboarding />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeInOut" }}
      >
        <Routes location={location}>
          <Route path="/auth"       element={<Auth />} />
          <Route path="/"           element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard"  element={<Navigate to="/" replace />} />
          <Route path="/tazkiyah"   element={<ProtectedRoute><TazkiyahHub /></ProtectedRoute>} />
          <Route path="/tazkiyah/challenges" element={<ProtectedRoute><Tazkiyah /></ProtectedRoute>} />
          <Route path="/lab"        element={<ProtectedRoute><LabHub /></ProtectedRoute>} />
          <Route path="/lab/alter-ego" element={<ProtectedRoute><AlterEgoLab /></ProtectedRoute>} />
          <Route path="/reflexion"  element={<ProtectedRoute><ReflexionHub /></ProtectedRoute>} />
          <Route path="/synergie"   element={<ProtectedRoute><SynergieHub /></ProtectedRoute>} />
          <Route path="/miroir"     element={<ProtectedRoute><MiroirAlliance /></ProtectedRoute>} />
          <Route path="/salat"      element={<ProtectedRoute><SalatTracker /></ProtectedRoute>} />
          <Route path="/hifz"       element={<ProtectedRoute><HifzTracker /></ProtectedRoute>} />
          <Route path="/journal"    element={<ProtectedRoute><JournalSakinah /></ProtectedRoute>} />
          <Route path="/deepwork"   element={<ProtectedRoute><DeepWork /></ProtectedRoute>} />
          <Route path="/chat"       element={<ProtectedRoute><DuoChat /></ProtectedRoute>} />
          <Route path="/bilan"      element={<ProtectedRoute><BilanSoir /></ProtectedRoute>} />
          <Route path="*"           element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors closeButton />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DuoPresenceProvider>
            <MidnightPenaltyGuard>
              <AudioEngineProvider>
                <AnimatedRoutes />
              </AudioEngineProvider>
            </MidnightPenaltyGuard>
          </DuoPresenceProvider>
          <NotificationOnboardingGate />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
