import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AudioEngineProvider } from "@/hooks/useAudioEngine";
import { AnimatePresence, motion } from "framer-motion";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TazkiyahHub from "./pages/TazkiyahHub";
import LabHub from "./pages/LabHub";
import ReflexionHub from "./pages/ReflexionHub";
import SynergieHub from "./pages/SynergieHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Routes location={location}>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/tazkiyah" element={<ProtectedRoute><TazkiyahHub /></ProtectedRoute>} />
          <Route path="/lab" element={<ProtectedRoute><LabHub /></ProtectedRoute>} />
          <Route path="/reflexion" element={<ProtectedRoute><ReflexionHub /></ProtectedRoute>} />
          <Route path="/synergie" element={<ProtectedRoute><SynergieHub /></ProtectedRoute>} />
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
