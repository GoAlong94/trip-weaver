import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plane, Calendar, Users, Receipt, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getLastActiveRoute } from "@/lib/trip-cache";

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Immediately resume into the app when user already has an active session
  useEffect(() => {
    if (!loading && user) {
      const lastRoute = getLastActiveRoute();
      navigate(lastRoute || "/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  if (!loading && user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-30 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <Plane className="h-5 w-5" />
            </div>
            <span>Wanderloom</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center">
        <section className="container mx-auto px-4 py-16 md:py-24 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Plan trips & split expenses effortlessly
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Every trip, expense & settlement in one workspace.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create a trip, invite your crew, log shared expenses in seconds, and see exact who-pays-who settlements without spreadsheet chaos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto gap-2">
              <Link to={user ? "/dashboard" : "/auth"}>
                Start Planning Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 text-left">
            <div className="rounded-2xl border border-border bg-card p-5">
              <Receipt className="h-5 w-5 text-primary mb-2.5" />
              <h3 className="font-semibold text-sm mb-1">Smart Ledger & Splits</h3>
              <p className="text-xs text-muted-foreground">
                Split equally or across selected members with automatic debt simplification.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Users className="h-5 w-5 text-primary mb-2.5" />
              <h3 className="font-semibold text-sm mb-1">Host Menu Control</h3>
              <p className="text-xs text-muted-foreground">
                Keep the mobile view lean—toggle optional planning modules on or off per trip.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Calendar className="h-5 w-5 text-primary mb-2.5" />
              <h3 className="font-semibold text-sm mb-1">Home Screen Web App</h3>
              <p className="text-xs text-muted-foreground">
                Install directly to your phone home screen for instant 0ms access on the road.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
