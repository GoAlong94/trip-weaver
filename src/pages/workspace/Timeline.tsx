import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Clock, GripVertical, Calendar as CalendarIcon, Loader2, X } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, addDays } from 'date-fns';
import { toast } from 'sonner';

const VERSIONS = [
  { id: 'idea', label: 'Brainstorming' },
  { id: 'draft_a', label: 'Draft A' },
  { id: 'draft_b', label: 'Draft B' },
  { id: 'active', label: 'Active Itinerary' }
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Timeline() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');

  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('idea');
  const [activeDate, setActiveDate] = useState<string>('');
  const [tripDays, setTripDays] = useState<Date[]>([]);
  const [draggedIdea, setDraggedIdea] = useState<string | null>(null);

  useEffect(() => {
    if (trip) {
      // Calculate the days of the trip
      try {
        const start = parseISO(trip.start_date || new Date().toISOString());
        // Default to a 3 day trip if end_date is missing or invalid
        const end = trip.end_date ? parseISO(trip.end_date) : addDays(start, 2);
        
        const days = eachDayOfInterval({ start, end });
        setTripDays(days);
        if (days.length > 0) {
          setActiveDate(format(days[0], 'yyyy-MM-dd'));
        }
      } catch (e) {
        console.error("Date parsing error", e);
      }
    }
    fetchTimeline();
  }, [tripId, trip]);

  const fetchTimeline = async () => {
    try {
      const { data, error } = await supabase
        .from('idea_cards')
        .select('*')
        .eq('trip_id', tripId);

      if (error) throw error;
      setIdeas(data || []);
    } catch (error: any) {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  // --- DRAG AND DROP HANDLERS ---
  
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("ideaId", id);
    setDraggedIdea(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDropOnTimeline = async (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("ideaId");
    if (!id || !activeDate) return;

    const startTime = `${hour.toString().padStart(2, '0')}:00:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00:00`;

    // Optimistic Update
    setIdeas(ideas.map(i => i.id === id ? { ...i, scheduled_date: activeDate, start_time: startTime, end_time: endTime } : i));
    setDraggedIdea(null);

    // Database Update
    const { error } = await supabase
      .from('idea_cards')
      .update({ scheduled_date: activeDate, start_time: startTime, end_time: endTime })
      .eq('id', id);

    if (error) {
      toast.error("Failed to schedule idea.");
      fetchTimeline(); // Revert on fail
    }
  };

  const handleDropOnUnscheduled = async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("ideaId");
    if (!id) return;

    // Optimistic Update
    setIdeas(ideas.map(i => i.id === id ? { ...i, scheduled_date: null, start_time: null, end_time: null } : i));
    setDraggedIdea(null);

    // Database Update
    const { error } = await supabase
      .from('idea_cards')
      .update({ scheduled_date: null, start_time: null, end_time: null })
      .eq('id', id);

    if (error) {
      toast.error("Failed to unschedule idea.");
      fetchTimeline();
    }
  };

  if (loading || !trip) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // --- FILTERING ---
  const currentDraftIdeas = ideas.filter(i => (i.draft_version || 'idea') === activeTab);
  const unscheduledIdeas = currentDraftIdeas.filter(i => !i.scheduled_date || !i.start_time);
  const scheduledIdeas = currentDraftIdeas.filter(i => i.scheduled_date === activeDate && i.start_time);

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col">
      
      {/* HEADER & DRAFT TABS */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Timeline Visualizer</h2>
        <p className="text-muted-foreground mt-1 text-sm">Drag cards from the pool onto the daily schedule.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4">
          {VERSIONS.map(v => (
             <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* DAY SELECTOR */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 border-b">
        {tripDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isActive = activeDate === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => setActiveDate(dateStr)}
              className={`flex flex-col items-center min-w-[80px] p-2 rounded-lg transition-colors ${
                isActive ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <span className="text-xs font-semibold uppercase opacity-80">Day {idx + 1}</span>
              <span className="font-bold">{format(day, 'MMM d')}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN WORKSPACE: Split View */}
      <div className="flex gap-6 flex-1 overflow-hidden mt-4">
        
        {/* LEFT: Unscheduled Bucket */}
        <div 
          className="w-1/3 flex flex-col bg-muted/30 rounded-xl border p-4"
          onDragOver={handleDragOver}
          onDrop={handleDropOnUnscheduled}
        >
          <div className="flex items-center gap-2 mb-4 text-muted-foreground border-b pb-2">
            <GripVertical className="h-4 w-4" />
            <h3 className="font-semibold text-sm uppercase">Unscheduled Pool</h3>
          </div>
          
          <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {unscheduledIdeas.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                No unscheduled ideas for this draft. Go to the Idea Board to add more!
              </div>
            ) : (
              unscheduledIdeas.map(idea => (
                <Card 
                  key={idea.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, idea.id)}
                  className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors bg-card shadow-sm"
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm leading-tight">{idea.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{idea.category}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">₹{idea.quantity * idea.unit_cost}</span>
                      </div>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-50" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Daily Timeline Grid */}
        <div className="w-2/3 overflow-y-auto pr-4 custom-scrollbar bg-background rounded-xl">
          <div className="relative">
            {HOURS.map(hour => {
              // Find items scheduled for this specific hour
              const itemsInHour = scheduledIdeas.filter(i => i.start_time?.startsWith(hour.toString().padStart(2, '0')));
              
              return (
                <div 
                  key={hour} 
                  className="flex min-h-[80px] border-b border-dashed border-border/60 group"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnTimeline(e, hour)}
                >
                  {/* Time Label */}
                  <div className="w-16 py-2 text-xs font-medium text-muted-foreground text-right pr-4 shrink-0 border-r border-border/40">
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                  
                  {/* Drop Zone & Cards */}
                  <div className="flex-1 p-2 relative group-hover:bg-muted/10 transition-colors flex flex-col gap-2">
                    {itemsInHour.map(idea => (
                      <Card 
                        key={idea.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, idea.id)}
                        className="bg-primary/5 border-primary/20 shadow-sm cursor-grab active:cursor-grabbing"
                      >
                        <CardContent className="p-3 flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="bg-background text-[10px]">{idea.category}</Badge>
                              {idea.visibility === 'private' && <Badge variant="secondary" className="text-[10px]">Private</Badge>}
                            </div>
                            <h4 className="font-semibold text-sm text-foreground">{idea.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {hour > 12 ? hour-12 : hour}:00 - {hour+1 > 12 ? hour+1-12 : hour+1}:00
                            </p>
                          </div>
                          
                          {/* Button to remove from timeline back to pool */}
                          <button 
                            onClick={() => {
                               // Simulate drag-drop to unscheduled
                               supabase.from('idea_cards').update({ scheduled_date: null, start_time: null, end_time: null }).eq('id', idea.id).then(() => fetchTimeline());
                            }}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Visual hint for dropzone when dragging */}
                    {draggedIdea && itemsInHour.length === 0 && (
                      <div className="hidden group-hover:block absolute inset-2 border-2 border-primary/40 border-dashed rounded-lg bg-primary/5 pointer-events-none" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
