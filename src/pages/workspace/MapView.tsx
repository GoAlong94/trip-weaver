import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Map as MapIcon, MapPin } from 'lucide-react';
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
  
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

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
    
    // Force resize calculation
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

    if (localHasPoints) {
      setTimeout(() => map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 }), 500);
    }

  }, [ideas, loading, scriptsLoaded]);

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

  return (
    <>
      {/* CRITICAL FIX: Direct CSS import prevents the iframe from blocking it */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      
      <div className="h-[calc(100vh-73px)] flex flex-col relative w-full">
        <div className="absolute top-6 left-6 z-[400] bg-card/90 backdrop-blur border p-4 rounded-xl shadow-lg max-w-sm pointer-events-auto">
          <h2 className="text-xl font-bold flex items-center gap-2"><MapIcon className="h-5 w-5 text-primary"/> Interactive Map</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Geocoded locations are plotted here. Scheduled activities show connecting routes!
          </p>
        </div>

        <div className="relative flex-1 w-full bg-muted/20">
           
           {/* If no coordinates exist, show a helpful message instead of a blank ocean */}
           {!hasPlottedPoints && (
             <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
               <div className="bg-card p-6 rounded-xl shadow-lg border text-center max-w-sm">
                 <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                 <h3 className="font-semibold text-lg">No Coordinates Found</h3>
                 <p className="text-sm text-muted-foreground mt-2">Open your Idea Cards and save an address to generate map coordinates.</p>
               </div>
             </div>
           )}

           <div ref={mapRef} className="absolute inset-0 z-0" />
        </div>

        <IdeaCardModal 
          idea={selectedIdea} isOpen={!!selectedIdea} 
          onClose={() => setSelectedIdea(null)} onUpdate={refreshData} memberCount={membersCount}
        />
      </div>
    </>
  );
}
