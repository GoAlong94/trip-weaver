import { useTrips } from '@/context/TripContext';
import { useAuth } from '@/context/AuthContext';
import TripCard from '@/components/TripCard';
import CreateTripDialog from '@/components/CreateTripDialog';
import { Plane, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { isPast, parseISO } from 'date-fns';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { trips, loading } = useTrips();
  const navigate = useNavigate();

  const activeTrips = trips.filter(t => !isPast(parseISO(t.end_date)));
  const pastTrips = trips.filter(t => isPast(parseISO(t.end_date)));

const handleLogout = async () => {
    // Simply clear the session. Do not call navigate() here.
    // The <ProtectedRoute> component will detect the null session and redirect safely.
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Wanderloom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.name || 'User'}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Trips</h1>
            <p className="text-muted-foreground mt-1">Plan, collaborate, and explore.</p>
          </div>
          <CreateTripDialog />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {activeTrips.length > 0 && (
              <section className="mb-10">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 font-sans">Upcoming</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeTrips.map((trip, i) => (
                    <TripCard key={trip.id} trip={trip} index={i} />
                  ))}
                </div>
              </section>
            )}

            {pastTrips.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 font-sans">Past Trips</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastTrips.map((trip, i) => (
                    <TripCard key={trip.id} trip={trip} index={i} />
                  ))}
                </div>
              </section>
            )}

            {trips.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg mb-2">No trips yet!</p>
                <p className="text-sm">Click "New Trip" to start planning your next adventure.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
