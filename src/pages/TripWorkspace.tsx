import { Outlet, useParams, Navigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import TripSidebar from '@/components/TripSidebar';
import { format, parseISO } from 'date-fns';
import { MapPin, Calendar } from 'lucide-react';

export default function TripWorkspace() {
  const { tripId } = useParams();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');

  if (!trip) return <Navigate to="/dashboard" replace />;

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
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{trip.destination}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(parseISO(trip.start_date), 'MMM d')} – {format(parseISO(trip.end_date), 'MMM d')}
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
