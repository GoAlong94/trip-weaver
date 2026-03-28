import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, X, Loader2, Plus, Eye, EyeOff, Users } from 'lucide-react';
import { format, parseISO, differenceInMinutes, differenceInHours, addMinutes, startOfHour, subHours, addHours, eachHourOfInterval } from 'date-fns';
import { toast } from 'sonner';
import IdeaCardModal from '@/components/IdeaCardModal';

const VERSIONS = [
  { id: 'idea', label: 'Brainstorming' },
  { id: 'draft_a', label: 'Draft A' },
  { id: 'draft_b', label: 'Draft B' },
  { id: 'active', label: 'Active Itinerary' }
];

const CATEGORIES = ['Locations', 'Transportation', 'Lodging', 'Food', 'Excursions', 'Entertainment', 'Other'];

// Modern "Liquid Glass" Color Palette - Consolidates hundreds of lines of CSS
const CATEGORY_COLORS: Record<string, string> = {
  'Locations': 'bg-blue-500/20 border-blue-400/50 text-blue-950 dark:text-blue-50 hover:bg-blue-400/30',
  'Transportation': 'bg-purple-500/20 border-purple-400/50 text-purple-950 dark:text-purple-50 hover:bg-purple-400/30',
  'Lodging': 'bg-amber-500/20 border-amber-400/50 text-amber-950 dark:text-amber-50 hover:bg-amber-400/30',
  'Food': 'bg-orange-500/20 border-orange-400/50 text-orange-950 dark:text-orange-50 hover:bg-orange-400/30',
  'Excursions': 'bg-emerald-500/20 border-emerald-400/50 text-emerald-950 dark:text-emerald-50 hover:bg-emerald-400/30',
  'Entertainment': 'bg-pink-500/20 border-pink-400/50 text-pink-950 dark:text-pink-50 hover:bg-pink-400/30',
  'Other': 'bg-slate-500/20 border-slate-400/50 text-slate-950 dark:text-slate-50 hover:bg-slate-400/30'
};

const MIN_CARD_WIDTH = 150; // The "Pill" protection boundary (in pixels)

export default function Timeline() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');

  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('idea');
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersCount, setMembersCount] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [unitCost, setUnitCost] = useState(0);
  const [visibility, setVisibility] = useState('public');
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  // Modal State
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);
  
  // Timeline Canvas State
  const [baseStart, setBaseStart] = useState<Date | null>(null);
  const [timelineHours, setTimelineHours] = useState<Date[]>([]);
  const [pixelsPerHour, setPixelsPerHour] = useState(180);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag & Resize State
  const [interaction, setInteraction] = useState<{ type: 'move' | 'resize-left' | 'resize-right'; id: string; startX: number; originalStart: Date; originalEnd: Date; } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const { data: mData } = await supabase.from('trip_members').select('user_id, profiles(name)').eq('trip_id', tripId);
        if (mData) {
            setMembersCount(mData.length || 1);
            setMembers(mData.filter(m => m.user_id !== user?.id));
        }
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

  // DYNAMIC BOUNDS & AUTO-ZOOM CALCULATION
  useEffect(() => {
    if (trip && !loading && !interaction) {
      const scheduled = ideas.filter(i => (i.draft_version || 'idea') === activeTab && i.start_datetime && i.end_datetime);
      
      let earliest = Date.now();
      let latest = earliest + 86400000; // Default to a 24h window if totally empty

      if (scheduled.length > 0) {
         earliest = Math.min(...scheduled.map(i => new Date(i.start_datetime).getTime()));
         latest = Math.max(...scheduled.map(i => new Date(i.end_datetime).getTime()));
      } else if (trip.start_date) {
         earliest = parseISO(trip.start_date).getTime();
         latest = earliest + 86400000;
      }

      // Exact padding: 2 hours before, 3 hours after the action
      const tStart = startOfHour(subHours(new Date(earliest), 2));
      const tEnd = startOfHour(addHours(new Date(latest), 3));

      // Calculate the "Fit to Screen" Zoom Level dynamically
      if (timelineRef.current) {
        const totalHours = differenceInHours(tEnd, tStart);
        const containerWidth = timelineRef.current.clientWidth;
        // Optimal zoom fills the screen, but never squishes smaller than 120px per hour
        const optimalZoom = Math.max(120, containerWidth / (totalHours || 1));
        setPixelsPerHour(optimalZoom);
      }

      setBaseStart(tStart);
      setTimelineHours(eachHourOfInterval({ start: tStart, end: tEnd }));
    }
  }, [trip, ideas, loading, activeTab, interaction]);

  const pixelsPerMinute = pixelsPerHour / 60;

  // FORM HANDLERS
  const handleAddIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const finalSharedWith = visibility === 'subgroup' ? [...sharedWith, user.id] : [];
      const newIdea = {
        trip_id: tripId, title, category, unit_cost: unitCost,
        created_by: user.id, draft_version: activeTab, visibility, shared_with: finalSharedWith,
        quantity: 1, quantity_type: 'fixed', upvotes: []
      };
      
      const { data, error } = await supabase.from('idea_cards').insert([newIdea]).select().single();
      if (error) throw error;
      
      toast.success('Idea added to Unscheduled pool!');
      setShowForm(false);
      setTitle(''); setUnitCost(0); setVisibility('public'); setSharedWith([]);
      setIdeas([...ideas, data]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleSubGroupMember = (memberId: string) => setSharedWith(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);

  // DRAG & DROP FROM POOL
  const handleDragStartPool = (e: React.DragEvent, id: string) => e.dataTransfer.setData("ideaId", id);

  const handleDropOnTimeline = async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("ideaId");
    if (!id || !baseStart || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const xPos = e.clientX - rect.left + scrollLeft;
    
    const dropMinutes = Math.floor(xPos / pixelsPerMinute);
    const newStart = addMinutes(baseStart, dropMinutes);
    const idea = ideas.find(i => i.id === id);
    // Default duration: 24h for locations, 2h for everything else
    const durationMins = idea?.category === 'Locations' ? (24 * 60) : 120;
    const newEnd = addMinutes(newStart, durationMins);

    updateIdeaDates(id, newStart, newEnd);
  };

  const removeFromTimeline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIdeas(ideas.map(i => i.id === id ? { ...i, start_datetime: null, end_datetime: null } : i));
    await supabase.from('idea_cards').update({ start_datetime: null, end_datetime: null }).eq('id', id);
  };

  // TIMELINE INTERACTION (MOVE/RESIZE)
  const handlePointerDown = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right', idea: any) => {
    e.stopPropagation();
    isDraggingRef.current = false;
    setInteraction({ type, id: idea.id, startX: e.pageX, originalStart: new Date(idea.start_datetime), originalEnd: new Date(idea.end_datetime) });
  };

  const handlePointerMove = useCallback((e: MouseEvent) => {
    if (!interaction) return;
    isDraggingRef.current = true;
    
    const deltaX = e.pageX - interaction.startX;
    const deltaMins = Math.round(deltaX / pixelsPerMinute / 15) * 15; // Snap to 15m intervals

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
  }, [interaction, pixelsPerMinute]);

  const handlePointerUp = useCallback(async () => {
    if (!interaction) return;
    const idea = ideas.find(i => i.id === interaction.id);
    if (idea) await updateIdeaDates(idea.id, new Date(idea.start_datetime), new Date(idea.end_datetime));
    
    setInteraction(null);
    // Tiny delay ensures `onClick` knows it was a drag, preventing the modal from popping open accidentally
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

  const currentDraftIdeas = ideas.filter(i => (i.draft_version || 'idea') === activeTab);
  const unscheduledIdeas = currentDraftIdeas.filter(i => !i.start_datetime);
  const scheduledIdeas = currentDraftIdeas.filter(i => i.start_datetime && i.end_datetime);

  // PIXEL-BASED PACKING (The Magic "Liquid Glass" Collision Engine)
  const packLane = (items: any[]) => {
    const sorted = [...items].sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
    const rows: number[] = []; 
    
    return sorted.map(item => {
      const startMins = differenceInMinutes(parseISO(item.start_datetime), baseStart);
      const durationMins = differenceInMinutes(parseISO(item.end_datetime), parseISO(item.start_datetime));
      
      const startPx = startMins * pixelsPerMinute;
      const rawWidthPx = durationMins * pixelsPerMinute;
      const actualWidthPx = Math.max(MIN_CARD_WIDTH, rawWidthPx); // Enforce Liquid Pill Boundary
      const endPx = startPx + actualWidthPx;

      let rowIndex = 0;
      // If the visual boundary overlaps with an existing card in this row, bump it down!
      while (rows[rowIndex] !== undefined && rows[rowIndex] > startPx - 10) {
        rowIndex++;
      }
      rows[rowIndex] = endPx;
      
      return { ...item, rowIndex, startPx, actualWidthPx };
    });
  };

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col overflow-hidden relative">
      
      {/* HEADER & FORM TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Continuous Planner</h2>
          <p className="text-muted-foreground mt-1 text-sm">Drag unscheduled ideas to the timeline, or click a card for exact manual scheduling.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4"/> Propose Idea</>}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 shrink-0">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4">
          {VERSIONS.map(v => <TabsTrigger key={v.id} value={v.id}>{v.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* INLINE NEW IDEA FORM */}
      {showForm && (
        <Card className="mb-6 border-primary/20 bg-muted/30 shadow-inner shrink-0">
          <CardContent className="pt-6">
            <form onSubmit={handleAddIdea} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="space-y-2 lg:col-span-2">
                <Label>Idea Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Secret Beer Run" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public"><div className="flex items-center gap-2"><Eye className="h-3 w-3"/> Public</div></SelectItem>
                    <SelectItem value="subgroup"><div className="flex items-center gap-2"><Users className="h-3 w-3"/> Sub-Group</div></SelectItem>
                    <SelectItem value="private"><div className="flex items-center gap-2"><EyeOff className="h-3 w-3"/> Private</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Est. Cost (₹)</Label>
                <Input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} required />
              </div>
              <Button type="submit" className="w-full h-10 lg:mt-6">Add to Pool</Button>
              
              {visibility === 'subgroup' && members.length > 0 && (
                  <div className="lg:col-span-6 bg-background p-4 rounded-md border mt-2">
                      <Label className="mb-3 block">Who is invited?</Label>
                      <div className="flex flex-wrap gap-4">
                          {members.map(m => (
                              <div key={m.user_id} className="flex items-center space-x-2">
                                  <Checkbox id={`member-${m.user_id}`} checked={sharedWith.includes(m.user_id)} onCheckedChange={() => toggleSubGroupMember(m.user_id)}/>
                                  <label htmlFor={`member-${m.user_id}`} className="text-sm font-medium leading-none">{m.profiles?.name || 'Unknown'}</label>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* MAIN WORKSPACE GRID */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* SMART UNSCHEDULED BUCKET (Disappears completely when empty!) */}
        {unscheduledIdeas.length > 0 && (
          <div className="w-64 flex flex-col bg-muted/30 rounded-xl border shrink-0 overflow-hidden shadow-inner">
            <div className="p-3 border-b bg-muted/50 font-semibold text-sm uppercase flex items-center justify-between">
              <span className="flex items-center gap-2"><GripVertical className="h-4 w-4" /> Unscheduled</span>
              <Badge variant="secondary">{unscheduledIdeas.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {unscheduledIdeas.map(idea => (
                <Card 
                  key={idea.id} draggable onDragStart={(e) => handleDragStartPool(e, idea.id)}
                  className="cursor-grab active:cursor-grabbing hover:border-primary/50 shadow-sm border-l-4"
                  style={{ borderLeftColor: 'var(--primary)' }}
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
          className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-background rounded-xl border relative select-none shadow-inner"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnTimeline}
        >
          <div style={{ width: timelineHours.length * pixelsPerHour, minHeight: '100%' }} className="relative flex flex-col">
            
            {/* STICKY GLASS HEADER */}
            <div className="sticky top-0 z-40 flex bg-card/70 backdrop-blur-xl border-b h-16 shadow-sm">
              {timelineHours.map((hour, hIdx) => (
                <div key={hIdx} style={{ width: pixelsPerHour }} className="shrink-0 border-r border-border/40 p-2 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-foreground leading-tight">{format(hour, 'h:mm a')}</span>
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">{format(hour, 'EEE, MMM d')}</span>
                </div>
              ))}
            </div>

            {/* BACKGROUND GRID */}
            <div className="absolute inset-0 top-[64px] flex pointer-events-none z-0">
              {timelineHours.map((_, i) => (
                <div key={i} style={{ width: pixelsPerHour }} className="shrink-0 border-r border-border/20 h-full bg-muted/5" />
              ))}
            </div>

            {/* LIQUID GLASS CATEGORY LANES */}
            <div className="relative z-10 flex-1 flex flex-col pt-6 pb-12">
              {CATEGORIES.map(category => {
                const laneItems = packLane(scheduledIdeas.filter(i => i.category === category));
                if (laneItems.length === 0) return null;

                const maxRow = Math.max(0, ...laneItems.map(i => i.rowIndex));
                const laneHeight = Math.max(90, (maxRow + 1) * 64 + 40);

                return (
                  <div key={category} style={{ minHeight: laneHeight }} className="relative w-full group mb-4">
                    
                    {/* Floating Category Label */}
                    <div className="sticky left-4 inline-block px-3 py-1 bg-background/90 backdrop-blur-sm rounded-md border text-xs font-bold text-muted-foreground uppercase z-30 shadow-sm mb-2">
                      {category}
                    </div>

                    {laneItems.map(idea => {
                      const top = 40 + (idea.rowIndex * 60);
                      const catStyle = CATEGORY_COLORS[idea.category] || CATEGORY_COLORS['Other'];

                      return (
                        <div 
                          key={idea.id}
                          style={{ left: idea.startPx, width: idea.actualWidthPx, top, position: 'absolute' }}
                          className={`h-12 rounded-xl border backdrop-blur-sm shadow-sm transition-all group/card flex 
                            ${catStyle} 
                            ${interaction?.id === idea.id ? 'z-50 ring-2 ring-primary scale-[1.02] shadow-xl' : 'z-20'}`}
                        >
                          <div 
                            className="w-3 shrink-0 cursor-ew-resize flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-l-xl z-20"
                            onMouseDown={(e) => handlePointerDown(e, 'resize-left', idea)}
                          >
                            <div className="w-1 h-4 bg-foreground/20 rounded-full" />
                          </div>

                          {/* THE MAGIC FIX: Overflow-clip contains boundaries, sticky slides text! */}
                          <div 
                            className="flex-1 relative h-full flex items-center cursor-grab active:cursor-grabbing z-10"
                            style={{ overflow: 'clip' }}
                            onMouseDown={(e) => handlePointerDown(e, 'move', idea)}
                            onClick={() => { if (!isDraggingRef.current) setSelectedIdea(idea); }}
                          >
                              {/* Sliding Text Label */}
                              <div className="sticky left-2 z-30 pointer-events-none flex flex-col justify-center drop-shadow-sm px-2 w-max max-w-full">
                                <div className="text-sm font-bold truncate tracking-tight">{idea.title}</div>
                                <div className="text-[10px] font-semibold opacity-80 truncate">
                                  {format(parseISO(idea.start_datetime), 'h:mm a')} - {format(parseISO(idea.end_datetime), 'h:mm a')}
                                </div>
                              </div>
                          </div>

                          <button 
                            onClick={(e) => removeFromTimeline(idea.id, e)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover/card:opacity-100 transition-opacity hover:scale-110 z-40 shadow-xl"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          <div 
                            className="w-3 shrink-0 cursor-ew-resize flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 rounded-r-xl z-20"
                            onMouseDown={(e) => handlePointerDown(e, 'resize-right', idea)}
                          >
                            <div className="w-1 h-4 bg-foreground/20 rounded-full" />
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
        idea={selectedIdea} isOpen={!!selectedIdea} 
        onClose={() => setSelectedIdea(null)} onUpdate={fetchTimeline} memberCount={membersCount}
      />
    </div>
  );
}
