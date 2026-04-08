import { useMidnightPenalty } from './hooks/useMidnightPenalty';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AudioEngineProvider } from "@/hooks/useAudioEngine";
import { AnimatePresence, motion } from "framer-motion";
import { SkeletonScreen } from "@/components/SkeletonScreen";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import TazkiyahHub from "./pages/TazkiyahHub";
import LabHub from "./pages/LabHub";
import ReflexionHub from "./pages/ReflexionHub";
import SynergieHub from "./pages/SynergieHub";
import MiroirAlliance from "./pages/MiroirAlliance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// 🛑 FIX CRITIQUE : ProtectedRoute attend explicitement la fin du loading
// avant de décider de rediriger — évite la boucle auth et l'écran noir
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Phase de chargement : on n'agit PAS encore — skeleton screen premium
  if (loading) return <SkeletonScreen />;

  // Auth confirmée absente : redirection propre
  if (!user) return <Navigate to="/auth" replace />;

  // Auth OK : on rend les enfants
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  useMidnightPenalty();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Routes location={location}>
          <Route path="/auth" element={<Auth />} />

          {/* Routes protégées */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/tazkiyah" element={<ProtectedRoute><TazkiyahHub /></ProtectedRoute>} />
          <Route path="/lab" element={<ProtectedRoute><LabHub /></ProtectedRoute>} />
          <Route path="/reflexion" element={<ProtectedRoute><ReflexionHub /></ProtectedRoute>} />
          <Route path="/synergie" element={<ProtectedRoute><SynergieHub /></ProtectedRoute>} />
          <Route path="/miroir" element={<ProtectedRoute><MiroirAlliance /></ProtectedRoute>} />

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
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AudioEngineProvider>
            <AnimatedRoutes />
          </AudioEngineProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
