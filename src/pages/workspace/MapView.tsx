import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import IdeaCardModal from '@/components/IdeaCardModal';

export default function MapView() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersCount, setMembersCount] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    fetchData();

    // Dynamically inject Leaflet CSS & JS so we don't need npm packages
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => initMap();
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, [tripId]);

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

  const initMap = () => {
    // @ts-ignore - Leaflet is attached to window by the script tag
    const L = window.L;
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    // Initialize Map (Default to World View if no points, or center on points later)
    mapInstanceRef.current = L.map(mapRef.current).setView([20, 0], 2);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    plotPoints();
  };

  const plotPoints = () => {
    // @ts-ignore
    const L = window.L;
    if (!L || !mapInstanceRef.current || ideas.length === 0) return;

    const map = mapInstanceRef.current;
    
    // Clear old markers if re-plotting
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const mappableIdeas = ideas.filter(i => i.location_lat && i.location_lng);
    if (mappableIdeas.length === 0) return;

    const bounds = L.latLngBounds();
    const routePoints: [number, number][] = [];

    // Sort by chronological order for the route line
    const scheduledIdeas = [...mappableIdeas]
      .filter(i => i.start_datetime)
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

    // Draw the Route Line
    scheduledIdeas.forEach(i => routePoints.push([i.location_lat, i.location_lng]));
    if (routePoints.length > 1) {
      L.polyline(routePoints, { color: '#0ea5e9', weight: 4, dashArray: '8, 8', opacity: 0.6 }).addTo(map);
    }

    // Add Markers
    mappableIdeas.forEach(idea => {
      const latlng = [idea.location_lat, idea.location_lng];
      bounds.extend(latlng);
      
      const marker = L.marker(latlng).addTo(map);
      
      // Custom popup HTML
      const popupContent = `
        <div style="min-width: 150px; padding: 4px;">
          <h4 style="font-weight: bold; margin: 0 0 4px 0; font-size: 14px;">${idea.title}</h4>
          <span style="font-size: 10px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${idea.category}</span>
          <br/><button onclick="window.dispatchEvent(new CustomEvent('openCard', {detail: '${idea.id}'}))" 
               style="margin-top: 8px; width: 100%; background: #0f172a; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">
            View Details
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);
    });

    // Fit map to show all points
    map.fitBounds(bounds, { padding: [50, 50] });
  };

  // Listen for popup clicks from Leaflet to open our React Modal
  useEffect(() => {
    const handleOpenCard = (e: any) => {
      const targetIdea = ideas.find(i => i.id === e.detail);
      if (targetIdea) setSelectedIdea(targetIdea);
    };
    window.addEventListener('openCard', handleOpenCard);
    return () => window.removeEventListener('openCard', handleOpenCard);
  }, [ideas]);

  // Re-plot when ideas change
  useEffect(() => {
    if (!loading) plotPoints();
  }, [ideas, loading]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col relative">
      <div className="absolute top-6 left-6 z-10 bg-card/90 backdrop-blur border p-4 rounded-xl shadow-lg max-w-sm">
        <h2 className="text-xl font-bold flex items-center gap-2"><MapIcon className="h-5 w-5 text-primary"/> Interactive Map</h2>
        <p className="text-sm text-muted-foreground mt-1">
          All your geocoded cards are plotted here. A blue line connects scheduled activities in chronological order!
        </p>
      </div>

      <div ref={mapRef} className="w-full h-full z-0 bg-muted/20" />

      <IdeaCardModal 
        idea={selectedIdea} 
        isOpen={!!selectedIdea} 
        onClose={() => setSelectedIdea(null)} 
        onUpdate={fetchData}
        memberCount={membersCount}
      />
    </div>
  );
}
