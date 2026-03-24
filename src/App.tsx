import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { TripProvider } from "@/context/TripContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TripWorkspace from "./pages/TripWorkspace";
import Overview from "./pages/workspace/Overview";
import IdeaBoard from "./pages/workspace/IdeaBoard";
import Timeline from "./pages/workspace/Timeline"; // NEW IMPORT
import PlaceholderTab from "./pages/workspace/PlaceholderTab";
import JoinTrip from "./pages/JoinTrip";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <TripProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/trip/:tripId" element={
                <ProtectedRoute><TripWorkspace /></ProtectedRoute>
              }>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<Overview />} />
                <Route path="ideas" element={<IdeaBoard />} />
                <Route path="timeline" element={<Timeline />} /> {/* UPDATED ROUTE */}
                <Route path="forecast" element={<PlaceholderTab />} />
                <Route path="ledger" element={<PlaceholderTab />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TripProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
