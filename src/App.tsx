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
import { MidnightPenaltyGuard } from "@/hooks/useMidnightPenalty";
import { NotificationOnboarding } from "@/components/NotificationOnboarding";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import TazkiyahHub from "./pages/TazkiyahHub";
import FocusHub from "./pages/FocusHub";
import ReflexionHub from "./pages/ReflexionHub";
import SynergieHub from "./pages/SynergieHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

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
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          <Route path="/tazkiyah" element={<ProtectedRoute><TazkiyahHub /></ProtectedRoute>} />
          <Route path="/focus" element={<ProtectedRoute><FocusHub /></ProtectedRoute>} />
          <Route path="/reflexion" element={<ProtectedRoute><ReflexionHub /></ProtectedRoute>} />
          <Route path="/synergie" element={<ProtectedRoute><SynergieHub /></ProtectedRoute>} />

          {/* Anciennes URLs → 4 piliers */}
          <Route path="/lab" element={<Navigate to="/focus" replace />} />
          <Route path="/lab/alter-ego" element={<Navigate to="/focus?tab=missions" replace />} />
          <Route path="/deepwork" element={<Navigate to="/focus?tab=deepwork" replace />} />
          <Route path="/salat" element={<Navigate to="/tazkiyah?tab=salat" replace />} />
          <Route path="/hifz" element={<Navigate to="/tazkiyah?tab=hifz" replace />} />
          <Route path="/tazkiyah/challenges" element={<Navigate to="/tazkiyah?tab=defis" replace />} />
          <Route path="/journal" element={<Navigate to="/reflexion?tab=journal" replace />} />
          <Route path="/bilan" element={<Navigate to="/reflexion?tab=bilan" replace />} />
          <Route path="/chat" element={<Navigate to="/synergie?tab=chat" replace />} />
          <Route path="/miroir" element={<Navigate to="/synergie?tab=miroir" replace />} />

          <Route path="*" element={<NotFound />} />
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
