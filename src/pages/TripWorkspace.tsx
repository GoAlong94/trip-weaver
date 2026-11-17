import { useEffect } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TripSidebar } from "@/components/TripSidebar";
import { TripMobileNav } from "@/components/TripMobileNav";
import { TripSectionSettings } from "@/components/TripSectionSettings";
import { useTrips } from "@/context/TripContext";
import { useAuth } from "@/context/AuthContext";
import { useTripData } from "@/hooks/useTripData";
import {
  getVisibleSections,
  normalizeSectionVisibility,
  tripSections,
} from "@/lib/trip-sections";
import { setLastActiveRoute } from "@/lib/trip-cache";

export default function TripWorkspace() {
  const { tripId } = useParams<{ tripId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getTrip, loading: tripsLoading, updateTripSectionVisibility } = useTrips();
  const { isTripHost } = useTripData(tripId);

  const trip = tripId ? getTrip(tripId) : undefined;
  const isHost = Boolean(
    user && trip && (trip.created_by === user.id || isTripHost)
  );

  const normalizedVisibility = normalizeSectionVisibility(
    trip?.section_visibility
  );
  const visibleSections = getVisibleSections(normalizedVisibility, isHost);

  // Save current workspace route so returning from mobile background resumes here
  useEffect(() => {
    if (location.pathname.startsWith("/trip/")) {
      setLastActiveRoute(location.pathname);
    }
  }, [location.pathname]);

  // Guard non-host members from navigating directly to disabled sections
  useEffect(() => {
    if (!trip || !tripId || isHost) return;

    const subPath = location.pathname
      .replace(`/trip/${tripId}`, "")
      .replace(/^\/+/, "");

    const currentSection =
      tripSections.find((s) => s.path === subPath) || tripSections[0];

    const isAllowed = visibleSections.some((s) => s.key === currentSection.key);
    if (!isAllowed) {
      const fallback = visibleSections[0];
      const nextUrl = fallback?.path
        ? `/trip/${tripId}/${fallback.path}`
        : `/trip/${tripId}`;
      navigate(nextUrl, { replace: true });
    }
  }, [trip, tripId, isHost, location.pathname, visibleSections, navigate]);

  // Only show spinner on cold load when trip isn't in cache yet
  if (!trip && tripsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Opening workspace…
      </div>
    );
  }

  if (!trip || !tripId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 p-4">
        <p className="text-sm text-muted-foreground">Trip not found.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm font-medium text-primary underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop Sidebar respects host's "Your menu" (visibleSections) */}
        <div className="hidden md:block">
          <TripSidebar
            trip={trip}
            sections={visibleSections}
            isHost={isHost}
            settingsSlot={
              isHost ? (
                <TripSectionSettings
                  tripId={trip.id}
                  visibility={normalizedVisibility}
                  onSave={updateTripSectionVisibility}
                />
              ) : null
            }
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top header with Host Section Settings button */}
          <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur">
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{trip.name}</h1>
              {trip.destination && (
                <p className="text-xs text-muted-foreground truncate">
                  {trip.destination}
                </p>
              )}
            </div>
            {isHost && (
              <TripSectionSettings
                tripId={trip.id}
                visibility={normalizedVisibility}
                onSave={updateTripSectionVisibility}
              />
            )}
          </header>

          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>

        {/* Mobile-only Splitwise-style bottom bar + auto-closing drawer */}
        <TripMobileNav
          tripId={trip.id}
          sections={visibleSections}
          isHost={isHost}
          allSections={tripSections}
        />
      </div>
    </SidebarProvider>
  );
}
