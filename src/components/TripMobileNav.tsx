import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { NavLink } from '@/components/NavLink';
import { tripSections } from '@/lib/trip-sections';

interface TripMobileNavProps {
  visibleSections: typeof tripSections[number][];
}

export default function TripMobileNav({ visibleSections }: TripMobileNavProps) {
  const { tripId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = visibleSections.find(section => location.pathname.endsWith(`/${section.path}`));
  const shortcuts = [...visibleSections.slice(0, 2)];
  if (current && !shortcuts.some(section => section.key === current.key)) {
    if (shortcuts.length === 2) shortcuts[1] = current;
    else shortcuts.push(current);
  }

  return (
    <>
      <nav aria-label="Trip navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-3">
          {shortcuts.map(section => (
            <NavLink
              key={section.key}
              to={`/trip/${tripId}/${section.path}`}
              aria-label={section.title}
              className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs text-muted-foreground"
              activeClassName="text-primary"
            >
              <section.icon className="h-5 w-5" />
              <span className="max-w-full truncate">{section.title}</span>
            </NavLink>
          ))}
          <Button
            type="button"
            variant="ghost"
            aria-label="Open trip sections"
            className="h-full flex-col gap-1 rounded-none text-xs text-muted-foreground"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span>Sections</span>
          </Button>
        </div>
      </nav>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>Trip sections</DrawerTitle>
            <DrawerDescription>{visibleSections.length} available</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            <div className="grid grid-cols-2 gap-2">
              {visibleSections.map(section => (
                <Button
                  key={section.key}
                  asChild
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-12 justify-start"
                >
                  <NavLink to={`/trip/${tripId}/${section.path}`} onClick={() => setDrawerOpen(false)}>
                    <section.icon className="h-4 w-4" />
                    <span className="text-left">{section.title}</span>
                  </NavLink>
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full justify-start"
              onClick={() => {
                setDrawerOpen(false);
                navigate('/dashboard');
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              All Trips
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}