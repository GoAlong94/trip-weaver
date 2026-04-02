import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTripData } from '@/hooks/useTripData';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Lightbulb, MapPin, Plane, Star, Sun, BedDouble, ChevronRight, MessageSquare, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IdeaCardModal from '@/components/IdeaCardModal';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

const COLUMNS = [
  { id: 'idea', title: 'Brainstorming', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'draft_a', title: 'Draft A', icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'draft_b', title: 'Draft B', icon: MapPin, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'active', title: 'Final Itinerary', icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
];

export default function IdeaBoard() {
  const { tripId } = useParams();
  const { user } = useAuth();
  
  // Instant Cache Engine
  const { ideas, members, loading, refreshData } = useTripData(tripId);
  const [selectedIdea, setSelectedIdea] = useState<any | null>(null);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const handleUpvote = async (ideaId: string, currentUpvotes: string[]) => {
    if (!user) return;
    try {
      const isUpvoted = currentUpvotes.includes(user.id);
      const newUpvotes = isUpvoted ? currentUpvotes.filter(id => id !== user.id) : [...currentUpvotes, user.id];
      await supabase.from('idea_cards').update({ upvotes: newUpvotes }).eq('id', ideaId);
      refreshData();
    } catch (e) {
      toast.error("Failed to vote");
    }
  };

  // --- SMART CARD RENDERER ---
  const renderSmartCard = (idea: any) => {
    const isUpvoted = idea.upvotes?.includes(user?.id);
    const hasDates = idea.start_datetime && idea.end_datetime;

    return (
      <Card 
        key={idea.id} 
        className="group hover:shadow-xl transition-all duration-200 border-border/50 bg-card overflow-hidden cursor-pointer"
        onClick={() => setSelectedIdea(idea)}
      >
        <CardContent className="p-0">
          
          {/* CARD HEADER */}
          <div className="p-4 pb-2">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">{idea.title}</h4>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider shrink-0 ml-2">{idea.category}</Badge>
            </div>

            {/* DEFAULT LOCATION STRING */}
            {idea.location_address && idea.category !== 'Transportation' && (
              <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1.5 line-clamp-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {idea.location_address}
              </p>
            )}
          </div>

          {/* --- SMART CATEGORY WIDGETS --- */}
          <div className="px-4 pb-3">
            
            {/* 1. TRANSPORTATION: Airline Ticket Layout */}
            {idea.category === 'Transportation' && idea.end_location_address && (
              <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-dashed flex items-center justify-between relative overflow-hidden">
                 <div className="w-2 h-4 rounded-r-full bg-background absolute -left-0 top-1/2 -translate-y-1/2 border border-l-0" />
                 <div className="w-2 h-4 rounded-l-full bg-background absolute -right-0 top-1/2 -translate-y-1/2 border border-r-0" />
                 
                 <div className="flex-1 pr-2">
                   <p className="text-[10px] text-muted-foreground uppercase">Origin</p>
                   <p className="font-semibold text-sm truncate">{idea.location_address?.split(',')[0] || 'TBD'}</p>
                 </div>
                 <div className="shrink-0 flex flex-col items-center px-2">
                   <Plane className="h-4 w-4 text-primary rotate-45" />
                   {hasDates && <span className="text-[9px] text-muted-foreground mt-1">{differenceInDays(parseISO(idea.end_datetime), parseISO(idea.start_datetime)) * 24}h</span>}
                 </div>
                 <div className="flex-1 pl-2 text-right">
                   <p className="text-[10px] text-muted-foreground uppercase">Dest</p>
                   <p className="font-semibold text-sm truncate">{idea.end_location_address?.split(',')[0] || 'TBD'}</p>
                 </div>
              </div>
            )}

            {/* 2. FOOD: Yelp-Style Ratings */}
            {idea.category === 'Food' && (
              <div className="mt-2 flex items-center gap-1.5 text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="font-bold text-xs">4.8</span>
                <span className="text-muted-foreground text-xs font-medium ml-1">(124 reviews) • {idea.unit_cost > 2000 ? '₹₹₹' : idea.unit_cost > 500 ? '₹₹' : '₹'}</span>
              </div>
            )}

            {/* 3. LODGING: Check-In/Out Banner */}
            {idea.category === 'Lodging' && hasDates && (
              <div className="mt-2 flex items-center justify-between bg-primary/5 border border-primary/20 text-primary p-2 rounded-md">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4" />
                  <span className="text-xs font-semibold">{differenceInDays(parseISO(idea.end_datetime), parseISO(idea.start_datetime))} Nights</span>
                </div>
                <div className="text-[10px] font-medium text-right">
                  <div>In: {format(parseISO(idea.start_datetime), 'MMM d')}</div>
                  <div>Out: {format(parseISO(idea.end_datetime), 'MMM d')}</div>
                </div>
              </div>
            )}

            {/* 4. LOCATIONS/EXCURSIONS: Weather Widget */}
            {(idea.category === 'Locations' || idea.category === 'Excursions') && hasDates && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
                <Sun className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold tracking-wide">24°C / 16°C Est.</span>
              </div>
            )}

          </div>

          {/* CARD FOOTER (VOTING & COMMENTS) */}
          <div className="border-t bg-muted/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-2 text-xs gap-1.5 rounded-full ${isUpvoted ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-muted'}`}
                onClick={(e) => { e.stopPropagation(); handleUpvote(idea.id, idea.upvotes || []); }}
              >
                <ArrowRight className={`h-3 w-3 -rotate-90 ${isUpvoted ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-semibold">{idea.upvotes?.length || 0}</span>
              </Button>
              <div className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
                <MessageSquare className="h-3.5 w-3.5" /> 0
              </div>
            </div>
            
            {/* Price Tag if assigned */}
            {idea.unit_cost > 0 && (
              <span className="text-xs font-mono font-bold text-foreground">
                {idea.currency || '₹'}{idea.unit_cost.toLocaleString()}
              </span>
            )}
          </div>

        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 h-[calc(100vh-73px)] flex flex-col overflow-hidden">
      <div className="mb-6 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Idea Board</h2>
          <p className="text-muted-foreground mt-1 text-sm">Propose ideas, vote, and drag them through the drafts.</p>
        </div>
        <Button onClick={() => setSelectedIdea({ trip_id: tripId, isNew: true })} className="gap-2 shadow-md">
          <Plus className="h-4 w-4" /> New Idea
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <div className="flex gap-6 h-full min-w-max pb-4">
          {COLUMNS.map(col => {
            const columnIdeas = ideas.filter(i => (i.draft_version || 'idea') === col.id);
            const Icon = col.icon;
            
            return (
              <div key={col.id} className="w-80 flex flex-col bg-muted/20 rounded-2xl border border-border/50">
                {/* Column Header */}
                <div className="p-4 border-b bg-card/50 rounded-t-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${col.bg}`}>
                      <Icon className={`h-4 w-4 ${col.color}`} />
                    </div>
                    <h3 className="font-semibold text-sm">{col.title}</h3>
                  </div>
                  <Badge variant="secondary" className="bg-background">{columnIdeas.length}</Badge>
                </div>
                
                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {columnIdeas.map(renderSmartCard)}
                  {columnIdeas.length === 0 && (
                    <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-xs text-muted-foreground font-medium">
                      Drop ideas here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <IdeaCardModal 
        idea={selectedIdea && !selectedIdea.isNew ? selectedIdea : null} 
        isOpen={!!selectedIdea && !selectedIdea.isNew} 
        onClose={() => setSelectedIdea(null)} 
        onUpdate={refreshData} 
        memberCount={members.length || 1} 
      />
    </div>
  );
}
