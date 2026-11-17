import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { LayoutGrid, ArrowLeft } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TripSectionItem } from "@/lib/trip-sections";

export interface TripMobileNavProps {
  tripId: string;
  sections: TripSectionItem[];
  isHost: boolean;
  allSections: TripSectionItem[];
}

export function TripMobileNav({
  tripId,
  sections,
  isHost,
  allSections,
}: TripMobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pin primary quick-access tabs in the bottom bar (Overview + The Ledger + up to 1 more)
  const pinnedSections = sections.slice(0, 3);
  const drawerSections = isHost ? allSections : sections;

  return (
    <nav
      aria-label="Mobile Trip Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-16 items-center px-1">
        {pinnedSections.map((section) => {
          const Icon = section.icon;
          const to = section.path
            ? `/trip/${tripId}/${section.path}`
            : `/trip/${tripId}`;

          return (
            <NavLink
              key={section.key}
              to={to}
              end={section.path === ""}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[72px]">{section.shortLabel}</span>
            </NavLink>
          );
        })}

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Sections</span>
            </button>
          </DrawerTrigger>

          <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <DrawerHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
              <DrawerTitle className="text-base">Trip Sections</DrawerTitle>
              <Link
                to="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Trips
              </Link>
            </DrawerHeader>

            <div className="grid grid-cols-3 gap-2.5 p-4">
              {drawerSections.map((section) => {
                const Icon = section.icon;
                const to = section.path
                  ? `/trip/${tripId}/${section.path}`
                  : `/trip/${tripId}`;
                const isHiddenFromMenu = !sections.some(
                  (s) => s.key === section.key
                );

                return (
                  <NavLink
                    key={section.key}
                    to={to}
                    end={section.path === ""}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-muted/30 text-foreground hover:bg-muted/60"
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs leading-tight line-clamp-1">
                      {section.shortLabel}
                    </span>
                    {isHost && isHiddenFromMenu && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}

export default TripMobileNav;
