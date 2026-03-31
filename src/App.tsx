import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DeepWork from "./pages/DeepWork";
import DuoChat from "./pages/DuoChat";
import Profile from "./pages/Profile";
import HifzTracker from "./pages/HifzTracker";
import JournalSakinah from "./pages/JournalSakinah";
import Tazkiyah from "./pages/Tazkiyah";
import SalatTracker from "./pages/SalatTracker";
import BilanSoir from "./pages/BilanSoir";
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
          <Route path="/deep-work" element={<ProtectedRoute><DeepWork /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><DuoChat /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/hifz" element={<ProtectedRoute><HifzTracker /></ProtectedRoute>} />
          <Route path="/journal" element={<ProtectedRoute><JournalSakinah /></ProtectedRoute>} />
          <Route path="/tazkiyah" element={<ProtectedRoute><Tazkiyah /></ProtectedRoute>} />
          <Route path="/salat" element={<ProtectedRoute><SalatTracker /></ProtectedRoute>} />
          <Route path="/bilan" element={<ProtectedRoute><BilanSoir /></ProtectedRoute>} />
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
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
