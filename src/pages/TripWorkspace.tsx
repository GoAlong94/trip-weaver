import { Outlet, useParams, Navigate, useLocation } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import TripSidebar from '@/components/TripSidebar';
import { format, parseISO } from 'date-fns';
import { MapPin, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTripData } from '@/hooks/useTripData';
import TripMobileNav from '@/components/TripMobileNav';
import TripSectionSettings from '@/components/TripSectionSettings';
import { readSectionVisibility, tripSections, type TripSectionVisibility } from '@/lib/trip-sections';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export default function TripWorkspace() {
  const { tripId } = useParams();
  const { getTrip, loading, trips, updateTrip } = useTrips();
  const { user } = useAuth();
  const location = useLocation();

  const trip = getTrip(tripId || '');
  const { members } = useTripData(tripId);

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

  const isHost = Boolean(user && trip.created_by === user.id);
  const currentMember = members.find(member => member.user_id === user?.id);
  const isTripHost = isHost || currentMember?.role === 'Host';
  const visibility = readSectionVisibility(trip.section_visibility);
  const visibleSections = tripSections.filter(section =>
    (isTripHost ? visibility.host[section.key] : visibility.members[section.key]),
  );
  const currentPath = location.pathname.split('/').pop();
  const requestedSection = tripSections.find(section => section.path === currentPath);
  if (requestedSection && !isTripHost && !visibility.members[requestedSection.key]) {
    const fallback = visibleSections[0];
    return <Navigate to={fallback ? `/trip/${trip.id}/${fallback.path}` : '/dashboard'} replace />;
  }

  const saveVisibility = async (nextVisibility: TripSectionVisibility) => {
    try {
      await updateTrip(trip.id, { section_visibility: nextVisibility as Json });
    } catch {
      toast.error('Could not save section visibility.');
      throw new Error('Section visibility save failed');
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <TripSidebar visibleSections={isTripHost ? tripSections.slice() : visibleSections} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card/80 backdrop-blur px-4 sticky top-0 z-20">
            <SidebarTrigger className="hidden md:flex" />
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
            {isHost && <TripSectionSettings visibility={visibility} onSave={saveVisibility} />}
          </header>
          <main className="flex-1 p-4 pb-24 md:p-6">
            <Outlet />
          </main>
        </div>
        <TripMobileNav visibleSections={visibleSections} />
      </div>
    </SidebarProvider>
  );
}
