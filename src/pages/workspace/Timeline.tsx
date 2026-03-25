import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GripVertical, X, Loader2, GripHorizontal } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, addDays, differenceInMinutes, startOfDay, endOfDay, addMinutes } from 'date-fns';
import { toast } from 'sonner';

const VERSIONS = [
  { id: 'idea', label: 'Brainstorming' },
  { id: 'draft_a', label: 'Draft A' },
  { id: 'draft_b', label: 'Draft B' },
  { id: 'active', label: 'Active Itinerary' }
];

const CATEGORIES = ['Locations', 'Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];

const PIXELS_PER_HOUR = 120; // Width of 1 hour in the timeline
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

export default function Timeline() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');

  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('idea');
  
  // Trip bounds
  const [tripStart, setTripStart] = useState<Date | null>(null);
  const [tripEnd, setTripEnd] = useState<Date | null>(null);
  const [tripDays, setTripDays] = useState<Date[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Smooth Interaction State (Dragging / Resizing on Timeline)
  const [interaction, setInteraction] = useState<{
    type: 'move' | 'resize-left' | 'resize-right';
    id: string;
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  useEffect(() => {
    if (trip) {
      try {
        const start = startOfDay(parseISO(trip.start_date || new Date().toISOString()));
        const end = endOfDay(trip.end_date ? parseISO(trip.end_date) : addDays(start, 2));
        setTripStart(start);
        setTripEnd(end);
        setTripDays(eachDayOfInterval({ start, end }));
      } catch (e) {
        console.error("Date parsing error", e);
      }
    }
    fetchTimeline();
  }, [tripId, trip]);

  const fetchTimeline = async () => {
    try {
      const { data, error } = await supabase.from('idea_cards').select('*').eq('trip_id', tripId);
      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  // --- HTML5 DnD: FROM POOL TO TIMELINE ---
  const handleDragStartPool = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("ideaId", id);
  };

  const handleDropOnTimeline = async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("ideaId");
    if (!id || !tripStart || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const xPos = e.clientX - rect.left + scrollLeft;
    
    // Calculate the drop time based on pixels
    const dropMinutes = Math.floor(xPos / PIXELS_PER_MINUTE);
    const newStart = addMinutes(tripStart, dropMinutes);
    
    // Default duration: Locations get 24 hours, others get 2 hours
    const idea = ideas.find(i => i.id === id);
    const durationMins = idea?.category === 'Locations' ? (24 * 60) : 120;
    const newEnd = addMinutes(newStart, durationMins);

    updateIdeaDates(id, newStart, newEnd);
  };

  const removeFromTimeline = async (id: string) => {
    setIdeas(ideas.map(i => i.id === id ? { ...i, start_datetime: null, end_datetime: null } : i));
    await supabase.from('idea_cards').update({ start_datetime: null, end_datetime: null } as any).eq('id', id);
  };

  // --- CUSTOM MOUSE EVENTS: RESIZING & SLIDING ON TIMELINE ---
  const handlePointerDown = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right', idea: any) => {
    e.stopPropagation();
    setInteraction({
      type,
      id: idea.id,
      startX: e.pageX,
      originalStart: new Date(idea.start_datetime),
      originalEnd: new Date(idea.end_datetime)
    });
  };

  const handlePointerMove = useCallback((e: MouseEvent) => {
    if (!interaction) return;
    
    const deltaX = e.pageX - interaction.startX;
    const deltaMins = Math.round(deltaX / PIXELS_PER_MINUTE / 15) * 15; // Snap to 15-minute increments

    setIdeas(prev => prev.map(idea => {
      if (idea.id !== interaction.id) return idea;
      
      let newStart = interaction.originalStart;
      let newEnd = interaction.originalEnd;

      if (interaction.type === 'move') {
        newStart = addMinutes(interaction.originalStart, deltaMins);
        newEnd = addMinutes(interaction.originalEnd, deltaMins);
      } else if (interaction.type === 'resize-left') {
        newStart = addMinutes(interaction.originalStart, deltaMins);
        if (newStart >= newEnd) newStart = addMinutes(newEnd, -15); // Prevent inversion
      } else if (interaction.type === 'resize-right') {
        newEnd = addMinutes(interaction.originalEnd, deltaMins);
        if (newEnd <= newStart) newEnd = addMinutes(newStart, 15);
      }

      return { ...idea, start_datetime: newStart.toISOString(), end_datetime: newEnd.toISOString() };
    }));
  }, [interaction]);

  const handlePointerUp = useCallback(async () => {
    if (!interaction) return;
    
    const idea = ideas.find(i => i.id === interaction.id);
    if (idea) {
      await updateIdeaDates(idea.id, new Date(idea.start_datetime), new Date(idea.end_datetime));
    }
    setInteraction(null);
  }, [interaction, ideas]);

  useEffect(() => {
    if (interaction) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    } else {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [interaction, handlePointerMove, handlePointerUp]);

  const updateIdeaDates = async (id: string, start: Date, end: Date) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, start_datetime: start.toISOString(), end_datetime: end.toISOString() } : i));
    await supabase.from('idea_cards').update({ start_datetime: start.toISOString(), end_datetime: end.toISOString() }).eq('id', id);
  };

  if (loading || !tripStart) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // --- FILTERING & RENDER MATH ---
  const currentDraftIdeas = ideas.filter(i => (i.draft_version || 'idea') === activeTab);
  const unscheduledIdeas = currentDraftIdeas.filter(i => !i.start_datetime);
  const scheduledIdeas = currentDraftIdeas.filter(i => i.start_datetime && i.end_datetime);

  const getLeftPos = (dateStr: string) => differenceInMinutes(parseISO(dateStr), tripStart) * PIXELS_PER_MINUTE;
  const getWidth = (startStr: string, endStr: string) => differenceInMinutes(parseISO(endStr), parseISO(startStr)) * PIXELS_PER_MINUTE;

  // Packing algorithm to prevent overlapping cards within the same lane
  const packLane = (items: any[]) => {
    const sorted = [...items].sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
    const rows: number[] = [];
    return sorted.map(item => {
      const start = new Date(item.start_datetime).getTime();
      const end = new Date(item.end_datetime).getTime();
      let rowIndex = 0;
      while (rows[rowIndex] && rows[rowIndex] > start) rowIndex++;
      rows[rowIndex] = end;
      return { ...item, rowIndex };
    });
  };

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col overflow-hidden">
      
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold tracking-tight">Continuous Planner</h2>
        <p className="text-muted-foreground mt-1 text-sm">Drag unscheduled ideas onto the timeline. Stretch the edges to adjust duration.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 shrink-0">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4">
          {VERSIONS.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* SPLIT VIEW */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* LEFT: Unscheduled Bucket */}
        <div className="w-64 flex flex-col bg-muted/30 rounded-xl border shrink-0 overflow-hidden">
          <div className="p-3 border-b bg-muted/50 font-semibold text-sm uppercase flex items-center gap-2">
            <GripVertical className="h-4 w-4" /> Unscheduled ({unscheduledIdeas.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {unscheduledIdeas.map(idea => (
              <Card 
                key={idea.id} draggable onDragStart={(e) => handleDragStartPool(e, idea.id)}
                className="cursor-grab active:cursor-grabbing hover:border-primary/50 shadow-sm"
              >
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm leading-tight">{idea.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{idea.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* RIGHT: Seamless Horizontal Gantt Chart */}
        <div 
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-background rounded-xl border relative select-none"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnTimeline}
        >
          <div style={{ width: tripDays.length * 24 * PIXELS_PER_HOUR, minHeight: '100%' }} className="relative flex flex-col">
            
            {/* TIMELINE RULER (DAYS & HOURS) */}
            <div className="sticky top-0 z-20 flex bg-card/90 backdrop-blur border-b">
              {tripDays.map((day, dIdx) => (
                <div key={dIdx} className="flex border-r border-border/50">
                  {Array.from({ length: 24 }).map((_, hIdx) => (
                    <div key={hIdx} style={{ width: PIXELS_PER_HOUR }} className="shrink-0 border-r border-border/30 p-1 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{format(day, 'MMM d')}</span> • {hIdx === 0 ? '12am' : hIdx < 12 ? `${hIdx}am` : hIdx === 12 ? '12pm' : `${hIdx-12}pm`}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* BACKGROUND GRID LINES */}
            <div className="absolute inset-0 top-[29px] flex pointer-events-none z-0">
              {Array.from({ length: tripDays.length * 24 }).map((_, i) => (
                <div key={i} style={{ width: PIXELS_PER_HOUR }} className="shrink-0 border-r border-border/20 h-full" />
              ))}
            </div>

            {/* CATEGORY LANES */}
            <div className="relative z-10 flex-1 flex flex-col pt-2">
              {CATEGORIES.map(category => {
                const laneItems = packLane(scheduledIdeas.filter(i => i.category === category));
                if (laneItems.length === 0) return null;

                // Calculate required height based on overlapping rows
                const maxRow = Math.max(0, ...laneItems.map(i => i.rowIndex));
                const laneHeight = Math.max(80, (maxRow + 1) * 56 + 40);

                return (
                  <div key={category} style={{ minHeight: laneHeight }} className="relative border-b border-border/40 w-full group">
                    <div className="sticky left-4 inline-block mt-2 px-2 py-0.5 bg-background/80 backdrop-blur rounded border text-xs font-bold text-muted-foreground uppercase z-10 shadow-sm">
                      {category}
                    </div>

                    {laneItems.map(idea => {
                      const left = getLeftPos(idea.start_datetime);
                      const width = Math.max(20, getWidth(idea.start_datetime, idea.end_datetime)); // Min 20px wide
                      const top = 36 + (idea.rowIndex * 54); // Stack overlaps neatly

                      return (
                        <div 
                          key={idea.id}
                          style={{ left, width, top, position: 'absolute' }}
                          className={`h-12 rounded-md shadow-sm border bg-card hover:border-primary/50 hover:shadow-md transition-shadow group/card flex ${interaction?.id === idea.id ? 'z-50 ring-2 ring-primary' : 'z-20'}`}
                        >
                          {/* Left Resize Handle */}
                          <div 
                            className="w-3 shrink-0 cursor-ew-resize flex items-center justify-center hover:bg-primary/20 rounded-l-md"
                            onMouseDown={(e) => handlePointerDown(e, 'resize-left', idea)}
                          >
                            <div className="w-0.5 h-4 bg-muted-foreground/30 rounded-full" />
                          </div>

                          {/* Card Body (Drag to Move) */}
                          <div 
                            className="flex-1 px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing flex flex-col justify-center"
                            onMouseDown={(e) => handlePointerDown(e, 'move', idea)}
                          >
                            <div className="text-xs font-semibold truncate leading-tight">{idea.title}</div>
                            <div className="text-[9px] text-muted-foreground truncate">
                              {format(parseISO(idea.start_datetime), 'h:mm a')} - {format(parseISO(idea.end_datetime), 'h:mm a')}
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFromTimeline(idea.id); }}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity hover:scale-110 z-30 shadow-md"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          {/* Right Resize Handle */}
                          <div 
                            className="w-3 shrink-0 cursor-ew-resize flex items-center justify-center hover:bg-primary/20 rounded-r-md"
                            onMouseDown={(e) => handlePointerDown(e, 'resize-right', idea)}
                          >
                            <div className="w-0.5 h-4 bg-muted-foreground/30 rounded-full" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
