import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import DeepWork from "./pages/DeepWork.tsx";
import DuoChat from "./pages/DuoChat.tsx";
import Profile from "./pages/Profile.tsx";
import HifzTracker from "./pages/HifzTracker.tsx";
import JournalSakinah from "./pages/JournalSakinah.tsx";
import Tazkiyah from "./pages/Tazkiyah.tsx";
import SalatTracker from "./pages/SalatTracker.tsx";
import BilanSoir from "./pages/BilanSoir.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/deep-work" element={<ProtectedRoute><DeepWork /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><DuoChat /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/hifz" element={<ProtectedRoute><HifzTracker /></ProtectedRoute>} />
    <Route path="/journal" element={<ProtectedRoute><JournalSakinah /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
