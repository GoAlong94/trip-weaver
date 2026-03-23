import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TripProvider } from "@/context/TripContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import TripWorkspace from "./pages/TripWorkspace";
import Overview from "./pages/workspace/Overview";
import PlaceholderTab from "./pages/workspace/PlaceholderTab";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TripProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trip/:tripId" element={<TripWorkspace />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="ideas" element={<PlaceholderTab />} />
              <Route path="timeline" element={<PlaceholderTab />} />
              <Route path="forecast" element={<PlaceholderTab />} />
              <Route path="ledger" element={<PlaceholderTab />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TripProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
