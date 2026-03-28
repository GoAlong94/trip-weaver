import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GripVertical, X, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInMinutes, addMinutes, startOfHour, subHours, addHours, eachHourOfInterval } from 'date-fns';
import { toast } from 'sonner';
import IdeaCardModal from '@/components/IdeaCardModal';

const VERSIONS = [
  { id: 'idea', label: 'Brainstorming' },
  { id: 'draft_a', label: 'Draft A' },
  { id: 'draft_b', label: 'Draft B' },
  { id: 'active', label: 'Active Itinerary' }
];

const CATEGORIES = ['Locations', 'Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];

// Increased width for the new beautiful Date/Time header
const PIXELS_PER_HOUR = 160; 
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

export default function Timeline() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');

  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('idea');
  
  // Modal State
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  const [membersCount, setMembersCount] = useState(1);
  
  // Dynamic Bounds State
  const [baseStart, setBaseStart] = useState<Date | null>(null);
  const [timelineHours, setTimelineHours] = useState<Date[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Smooth Interaction State (Dragging / Resizing)
  const [interaction, setInteraction] = useState<{ type: 'move' | 'resize-left' | 'resize-right'; id: string; startX: number; originalStart: Date; originalEnd: Date; } | null>(null);
  const isDraggingRef = useRef(false);

  // Fetch Members & Ideas
  useEffect(() => {
    const initData = async () => {
      try {
        const { data: mData } = await supabase.from('trip_members').select('user_id').eq('trip_id', tripId);
        if (mData) setMembersCount(mData.length || 1);
        await fetchTimeline();
      } catch (e) {
        console.error(e);
      }
    };
    initData();
  }, [tripId]);

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

  // Calculate Dynamic Tight Bounds (Hugs the earliest/latest item)
  useEffect(() => {
    if (trip && !loading && !interaction) {
      const scheduled = ideas.filter(i => (i.draft_version || 'idea') === activeTab && i.start_datetime && i.end_datetime);
      
      let earliest = trip.start_date ? parseISO(trip.start_date).getTime() : Date.now();
      let latest = trip.end_date ? parseISO(trip.end_date).getTime() : earliest + (2 * 24 * 60 * 60 * 1000);

      // If items exist, shrink the bounds tightly around them!
      if (scheduled.length > 0) {
         const minIdea = Math.min(...scheduled.map(i => new Date(i.start_datetime).getTime()));
         const maxIdea = Math.max(...scheduled.map(i => new Date(i.end_datetime).getTime()));
         earliest = Math.min(earliest, minIdea);
         latest = Math.max(latest, maxIdea);
      }

      // Add exactly 1 hour of padding on the left and 2 on the right
      const tStart = startOfHour(subHours(new Date(earliest), 1));
      const tEnd = startOfHour(addHours(new Date(latest), 2));

      setBaseStart(tStart);
      setTimelineHours(eachHourOfInterval({ start: tStart, end: tEnd }));
    }
  }, [trip, ideas, loading, activeTab, interaction]);


  // --- HTML5 DnD: FROM POOL TO TIMELINE ---
  const handleDragStartPool = (e: React.DragEvent, id: string) => e.dataTransfer.setData("ideaId", id);

  const handleDropOnTimeline = async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("ideaId");
    if (!id || !baseStart || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const xPos = e.clientX - rect.left + scrollLeft;
    
    const dropMinutes = Math.floor(xPos / PIXELS_PER_MINUTE);
    const newStart = addMinutes(baseStart, dropMinutes);
    const idea = ideas.find(i => i.id === id);
    const durationMins = idea?.category === 'Locations' ? (24 * 60) : 120;
    const newEnd = addMinutes(newStart, durationMins);

    updateIdeaDates(id, newStart, newEnd);
  };

  const removeFromTimeline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger modal click
    setIdeas(ideas.map(i => i.id === id ? { ...i, start_datetime: null, end_datetime: null } : i));
    await supabase.from('idea_cards').update({ start_datetime: null, end_datetime: null }).eq('id', id);
  };

  // --- CUSTOM MOUSE EVENTS: RESIZING & SLIDING ON TIMELINE ---
  const handlePointerDown = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right', idea: any) => {
    e.stopPropagation();
    isDraggingRef.current = false;
    setInteraction({ type, id: idea.id, startX: e.pageX, originalStart: new Date(idea.start_datetime), originalEnd: new Date(idea.end_datetime) });
  };

  const handlePointerMove = useCallback((e: MouseEvent) => {
    if (!interaction) return;
    isDraggingRef.current = true; // Mark as dragging so we don't open modal on release
    
    const deltaX = e.pageX - interaction.startX;
    const deltaMins = Math.round(deltaX / PIXELS_PER_MINUTE / 15) * 15; 

    setIdeas(prev => prev.map(idea => {
      if (idea.id !== interaction.id) return idea;
      let newStart = interaction.originalStart;
      let newEnd = interaction.originalEnd;

      if (interaction.type === 'move') {
        newStart = addMinutes(interaction.originalStart, deltaMins);
        newEnd = addMinutes(interaction.originalEnd, deltaMins);
      } else if (interaction.type === 'resize-left') {
        newStart = addMinutes(interaction.originalStart, deltaMins);
        if (newStart >= newEnd) newStart = addMinutes(newEnd, -15);
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
    if (idea) await updateIdeaDates(idea.id, new Date(idea.start_datetime), new Date(idea.end_datetime));
    
    setInteraction(null);
    // Allow a small delay before resetting drag flag so click handler doesn't fire instantly
    setTimeout(() => { isDraggingRef.current = false; }, 100);
  }, [interaction, ideas]);

  useEffect(() => {
    if (interaction) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
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

  if (loading || !baseStart) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // --- FILTERING & RENDER MATH ---
  const currentDraftIdeas = ideas.filter(i => (i.draft_version || 'idea') === activeTab);
  const unscheduledIdeas = currentDraftIdeas.filter(i => !i.start_datetime);
  const scheduledIdeas = currentDraftIdeas.filter(i => i.start_datetime && i.end_datetime);

  const getLeftPos = (dateStr: string) => differenceInMinutes(parseISO(dateStr), baseStart) * PIXELS_PER_MINUTE;
  const getWidth = (startStr: string, endStr: string) => differenceInMinutes(parseISO(endStr), parseISO(startStr)) * PIXELS_PER_MINUTE;

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
        <p className="text-muted-foreground mt-1 text-sm">Drag unscheduled ideas onto the timeline, or click a card to open manual adjusters.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 shrink-0">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4">
          {VERSIONS.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* SMART UNSCHEDULED BUCKET (Hides if empty!) */}
        {unscheduledIdeas.length > 0 && (
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
        )}

        {/* DYNAMIC TIMELINE CANVAS */}
        <div 
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-background rounded-xl border relative select-none"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnTimeline}
        >
          <div style={{ width: timelineHours.length * PIXELS_PER_HOUR, minHeight: '100%' }} className="relative flex flex-col">
            
            {/* BIGGER HEADER WITH DAYS */}
            <div className="sticky top-0 z-20 flex bg-card/90 backdrop-blur border-b h-14">
              {timelineHours.map((hour, hIdx) => (
                <div key={hIdx} style={{ width: PIXELS_PER_HOUR }} className="shrink-0 border-r border-border/30 p-2 flex flex-col items-center justify-center bg-muted/10">
                  <span className="text-sm font-bold text-foreground">{format(hour, 'h:mm a')}</span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{format(hour, 'EEE, MMM d')}</span>
                </div>
              ))}
            </div>

            {/* BACKGROUND GRID LINES */}
            <div className="absolute inset-0 top-[56px] flex pointer-events-none z-0">
              {timelineHours.map((_, i) => (
                <div key={i} style={{ width: PIXELS_PER_HOUR }} className="shrink-0 border-r border-border/20 h-full" />
              ))}
            </div>

            {/* CATEGORY LANES */}
            <div className="relative z-10 flex-1 flex flex-col pt-4">
              {CATEGORIES.map(category => {
                const laneItems = packLane(scheduledIdeas.filter(i => i.category === category));
                if (laneItems.length === 0) return null;

                const maxRow = Math.max(0, ...laneItems.map(i => i.rowIndex));
                const laneHeight = Math.max(80, (maxRow + 1) * 56 + 40);

                return (
                  <div key={category} style={{ minHeight: laneHeight }} className="relative border-b border-border/40 w-full group">
                    <div className="sticky left-4 inline-block mt-2 px-2 py-0.5 bg-background/80 backdrop-blur rounded border text-xs font-bold text-muted-foreground uppercase z-10 shadow-sm">
                      {category}
                    </div>

                    {laneItems.map(idea => {
                      const left = getLeftPos(idea.start_datetime);
                      const width = Math.max(20, getWidth(idea.start_datetime, idea.end_datetime));
                      const top = 36 + (idea.rowIndex * 54);

                      return (
                        <div 
                          key={idea.id}
                          style={{ left, width, top, position: 'absolute' }}
                          className={`h-12 rounded-md shadow-sm border bg-card hover:border-primary/50 hover:shadow-md transition-shadow group/card flex ${interaction?.id === idea.id ? 'z-50 ring-2 ring-primary' : 'z-20'}`}
                        >
                          <div 
                            className="w-3 shrink-0 cursor-ew-resize flex items-center justify-center hover:bg-primary/20 rounded-l-md"
                            onMouseDown={(e) => handlePointerDown(e, 'resize-left', idea)}
                          >
                            <div className="w-0.5 h-4 bg-muted-foreground/30 rounded-full" />
                          </div>

                          <div 
                            className="flex-1 px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing flex flex-col justify-center"
                            onMouseDown={(e) => handlePointerDown(e, 'move', idea)}
                            onClick={() => {
                               // Open Modal on click, but ONLY if we didn't just finish dragging it
                               if (!isDraggingRef.current) setSelectedIdea(idea);
                            }}
                          >
                            <div className="text-xs font-semibold truncate leading-tight">{idea.title}</div>
                            <div className="text-[9px] text-muted-foreground truncate">
                              {format(parseISO(idea.start_datetime), 'h:mm a')} - {format(parseISO(idea.end_datetime), 'h:mm a')}
                            </div>
                          </div>

                          <button 
                            onClick={(e) => removeFromTimeline(idea.id, e)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity hover:scale-110 z-30 shadow-md"
                          >
                            <X className="h-3 w-3" />
                          </button>

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

      <IdeaCardModal 
        idea={selectedIdea} 
        isOpen={!!selectedIdea} 
        onClose={() => setSelectedIdea(null)} 
        onUpdate={fetchTimeline}
        memberCount={membersCount}
      />
    </div>
  );
}
