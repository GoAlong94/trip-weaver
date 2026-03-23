import { Outlet, useParams, Navigate, useNavigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import TripSidebar from '@/components/TripSidebar';
import { format, parseISO } from 'date-fns';
import { MapPin, Calendar, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function TripWorkspace() {
  const { tripId } = useParams();
  const { getTrip, loading, trips } = useTrips();
  const navigate = useNavigate();

  const trip = getTrip(tripId || '');

  // Defensive Date Formatting so parseISO doesn't crash on bad data
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d');
    } catch (e) {
      return '';
    }
  };

  // 1. Wait for TripContext to finish fetching
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading workspace...</p>
      </div>
    );
  }

  // 2. If loading is totally finished, and the trip still isn't in the array, redirect safely
  if (!loading && trips.length > 0 && !trip) {
    console.warn("Trip not found after loading. Redirecting to Dashboard.");
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Absolute safety catch: If trips array is totally empty but loading is false
  if (!trip) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-medium">
           Synchronizing data...
        </div>
     );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <TripSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card/80 backdrop-blur px-4 sticky top-0 z-20">
            <SidebarTrigger />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">{trip.cover_emoji}</span>
              <h1 className="font-display text-lg font-semibold truncate">{trip.title}</h1>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.start_destination}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
              </span>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
