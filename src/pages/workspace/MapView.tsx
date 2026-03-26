import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Map as MapIcon, MapPin, Navigation, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import IdeaCardModal from '@/components/IdeaCardModal';

export default function MapView() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersCount, setMembersCount] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  const [hasPlottedPoints, setHasPlottedPoints] = useState(false);
  
  // View Toggle State
  const [activeView, setActiveView] = useState('custom'); // 'custom' | 'carousel'

  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // 1. Load Leaflet Scripts Safely
  useEffect(() => {
    let checkInterval: any;
    const checkLeaflet = () => {
      if ((window as any).L) {
        setScriptsLoaded(true);
        clearInterval(checkInterval);
      }
    };

    if (!document.getElementById('leaflet-script')) {
      const script = document.createElement('script');
      script.id = 'leaflet-script';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      document.head.appendChild(script);
    }

    checkInterval = setInterval(checkLeaflet, 100);
    return () => clearInterval(checkInterval);
  }, []);

  // 2. Fetch Trip Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: memberData } = await supabase.from('trip_members').select('user_id').eq('trip_id', tripId);
        if (memberData) setMembersCount(memberData.length || 1);

        const { data, error } = await supabase.from('idea_cards').select('*').eq('trip_id', tripId);
        if (error) throw error;
        setIdeas(data || []);
      } catch (error) {
        toast.error("Failed to load map data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tripId]);

  // 3. Initialize and Plot Leaflet Custom Map
  useEffect(() => {
    if (!scriptsLoaded || loading || !mapRef.current) return;

    // @ts-ignore
    const L = window.L;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([20, 0], 2);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    
    // Force resize calculation so map tiles don't break when switching tabs
    setTimeout(() => map.invalidateSize(), 400);

    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds();
    let localHasPoints = false;
    const routePoints: [number, number][] = [];

    const scheduledIdeas = [...ideas]
      .filter(i => i.start_datetime)
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

    scheduledIdeas.forEach(idea => {
      if (idea.location_lat && idea.location_lng) routePoints.push([idea.location_lat, idea.location_lng]);
      if (idea.category === 'Transportation' && idea.end_location_lat && idea.end_location_lng) {
        routePoints.push([idea.end_location_lat, idea.end_location_lng]);
      }
    });

    if (routePoints.length > 1) {
      L.polyline(routePoints, { color: '#ef4444', weight: 4, dashArray: '10, 10', opacity: 0.8 }).addTo(map);
    }

    ideas.forEach(idea => {
      const createPopup = (label: string) => `
        <div style="min-width: 150px; padding: 4px;">
          <h4 style="font-weight: bold; margin: 0 0 4px 0; font-size: 14px;">${idea.title} ${label}</h4>
          <span style="font-size: 10px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: black;">${idea.category}</span>
          <br/><button onclick="window.dispatchEvent(new CustomEvent('openCard', {detail: '${idea.id}'}))" 
               style="margin-top: 8px; width: 100%; background: #0f172a; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">
            View Details
          </button>
        </div>
      `;

      if (idea.location_lat && idea.location_lng) {
        localHasPoints = true;
        const latlng = [idea.location_lat, idea.location_lng];
        bounds.extend(latlng);
        L.marker(latlng).addTo(map).bindPopup(createPopup(idea.category === 'Transportation' ? '(Origin)' : ''));
      }

      if (idea.category === 'Transportation' && idea.end_location_lat && idea.end_location_lng) {
        localHasPoints = true;
        const latlng = [idea.end_location_lat, idea.end_location_lng];
        bounds.extend(latlng);
        L.marker(latlng).addTo(map).bindPopup(createPopup('(Destination)'));
      }
    });

    setHasPlottedPoints(localHasPoints);

    if (localHasPoints && activeView === 'custom') {
      setTimeout(() => map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 }), 500);
    }

  }, [ideas, loading, scriptsLoaded, activeView]);

  // Handle Popup Clicks from Custom Map
  useEffect(() => {
    const handleOpenCard = (e: any) => {
      const targetIdea = ideas.find(i => i.id === e.detail);
      if (targetIdea) setSelectedIdea(targetIdea);
    };
    window.addEventListener('openCard', handleOpenCard);
    return () => window.removeEventListener('openCard', handleOpenCard);
  }, [ideas]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('idea_cards').select('*').eq('trip_id', tripId);
      if (error) throw error;
      setIdeas(data || []);
    } catch (e) {
      toast.error("Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  if (!scriptsLoaded || loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // GOOGLE CAROUSEL LOGIC: Get scheduled cards that actually have text addresses to plot
  const carouselIdeas = [...ideas]
    .filter(i => i.start_datetime && i.location_address)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      
      <div className="h-[calc(100vh-73px)] flex flex-col relative w-full bg-muted/20 overflow-hidden">
        
        {/* FLOATING HEADER & TABS */}
        <div className="absolute top-6 left-6 right-6 z-[400] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pointer-events-none">
          <div className="bg-card/90 backdrop-blur border p-4 rounded-xl shadow-lg max-w-sm pointer-events-auto">
            <h2 className="text-xl font-bold flex items-center gap-2"><MapIcon className="h-5 w-5 text-primary"/> Trip Viewer</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-tight">
              {activeView === 'custom' 
                ? 'A macro-level view of all geocoded coordinates.' 
                : 'A chronological slideshow of your itinerary with live Google Maps routing.'}
            </p>
          </div>

          <div className="pointer-events-auto shadow-lg rounded-lg bg-card/90 backdrop-blur">
            <Tabs value={activeView} onValueChange={setActiveView} className="w-full md:w-[350px]">
              <TabsList className="grid w-full grid-cols-2 p-1">
                <TabsTrigger value="custom">Custom Global Map</TabsTrigger>
                <TabsTrigger value="carousel">Google Carousel</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* VIEW 1: CUSTOM LEAFLET MAP */}
        <div className={`absolute inset-0 z-0 ${activeView === 'custom' ? 'block' : 'hidden'}`}>
           {!hasPlottedPoints && (
             <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
               <div className="bg-card p-6 rounded-xl shadow-lg border text-center max-w-sm">
                 <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                 <h3 className="font-semibold text-lg">No Coordinates Found</h3>
                 <p className="text-sm text-muted-foreground mt-2">Open an Idea Card and run the API Tester to plot points here.</p>
               </div>
             </div>
           )}
           <div ref={mapRef} className="absolute inset-0" />
        </div>

        {/* VIEW 2: GOOGLE MAPS CAROUSEL */}
        {activeView === 'carousel' && (
          <div className="absolute inset-0 z-10 pt-[160px] pb-8 flex items-center overflow-x-auto snap-x snap-mandatory px-8 gap-8 custom-scrollbar">
             {carouselIdeas.length === 0 ? (
                <div className="w-full flex items-center justify-center text-muted-foreground flex-col h-full">
                   <Navigation className="h-16 w-16 mb-4 opacity-20" />
                   <h2 className="text-2xl font-semibold text-foreground">No Itinerary Found</h2>
                   <p className="mt-2 text-center max-w-md">
                     To view the slideshow, your Idea Cards must have a Location Address AND be scheduled on the Timeline.
                   </p>
                </div>
             ) : (
                carouselIdeas.map((idea, idx) => (
                   <div key={idea.id} className="min-w-[85vw] md:min-w-[60vw] lg:min-w-[50vw] h-full max-h-[75vh] shrink-0 snap-center bg-card rounded-2xl border shadow-2xl flex flex-col overflow-hidden relative">
                       {/* Slide Number */}
                       <div className="absolute top-4 left-4 z-20 bg-primary text-primary-foreground h-10 w-10 rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-background">
                         {idx + 1}
                       </div>
                       
                       {/* Header Block */}
                       <div className="p-6 border-b bg-muted/40 pl-16 shrink-0">
                           <div className="flex justify-between items-start gap-4">
                             <div>
                               <h3 className="text-2xl font-bold tracking-tight">{idea.title}</h3>
                               <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                  <Badge variant="outline" className="bg-background">{idea.category}</Badge>
                                  {idea.start_datetime && (
                                    <span className="flex items-center gap-1 font-medium bg-background px-2 py-0.5 rounded-md border shadow-sm">
                                      <Clock className="h-3.5 w-3.5 text-primary"/> 
                                      {format(parseISO(idea.start_datetime), 'MMM d • h:mm a')}
                                    </span>
                                  )}
                               </div>
                             </div>
                             <Button variant="secondary" onClick={() => setSelectedIdea(idea)} className="shrink-0">View Details</Button>
                           </div>
                       </div>
                       
                       {/* Live Google iframe */}
                       <div className="flex-1 w-full bg-muted relative">
                          <iframe
                            width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen
                            src={idea.category === 'Transportation' && idea.end_location_address
                              ? `https://maps.google.com/maps?saddr=${encodeURIComponent(idea.location_address)}&daddr=${encodeURIComponent(idea.end_location_address)}&output=embed`
                              : `https://maps.google.com/maps?q=${encodeURIComponent(idea.location_address)}&output=embed`}
                          />
                       </div>
                   </div>
                ))
             )}
          </div>
        )}

        <IdeaCardModal 
          idea={selectedIdea} isOpen={!!selectedIdea} 
          onClose={() => setSelectedIdea(null)} onUpdate={refreshData} memberCount={membersCount}
        />
      </div>
    </>
  );
}
