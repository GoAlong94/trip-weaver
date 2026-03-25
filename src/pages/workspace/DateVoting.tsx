import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, HelpCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DateVoting() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [votes, setVotes] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tripId, currentDate]);

  const fetchData = async () => {
    if (!tripId) return;
    try {
      // 1. Fetch Trip Members to know the total roster
      const { data: memberData } = await supabase
        .from('trip_members')
        .select('user_id, profiles(name)')
        .eq('trip_id', tripId);
      setMembers(memberData || []);

      // 2. Fetch all votes for this trip
      const { data: voteData, error } = await (supabase
        .from('trip_date_votes' as any)
        .select('*')
        .eq('trip_id', tripId)) as any;
      
      if (error) throw error;
      setVotes(voteData || []);
    } catch (error: any) {
      toast.error("Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (dateStr: string) => {
    if (!user) return;
    
    // Find current user's vote for this specific day
    const existingVote = votes.find(v => v.vote_date === dateStr && v.user_id === user.id);
    let newStatus = 'available';

    // Cycle through the voting states
    if (existingVote?.status === 'available') newStatus = 'maybe';
    else if (existingVote?.status === 'maybe') newStatus = 'unavailable';
    else if (existingVote?.status === 'unavailable') newStatus = 'clear';

    // Optimistically update UI
    if (newStatus === 'clear') {
      setVotes(votes.filter(v => !(v.vote_date === dateStr && v.user_id === user.id)));
      await supabase.from('trip_date_votes').delete().match({ trip_id: tripId, user_id: user.id, vote_date: dateStr });
    } else {
      const newVoteObj = { trip_id: tripId, user_id: user.id, vote_date: dateStr, status: newStatus };
      const otherVotes = votes.filter(v => !(v.vote_date === dateStr && v.user_id === user.id));
      setVotes([...otherVotes, newVoteObj]);
      
      await supabase.from('trip_date_votes').upsert(newVoteObj);
    }
  };

  const renderMonth = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });
    const startDayOfWeek = start.getDay(); // 0 = Sunday

    // Pad the beginning of the month grid
    const padding = Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`pad-${i}`} className="h-24 p-2" />);

    return (
      <div className="flex-1 bg-card rounded-xl border shadow-sm overflow-hidden min-w-[300px]">
        <div className="bg-muted/50 p-4 border-b text-center font-bold text-lg">
          {format(monthDate, 'MMMM yyyy')}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-muted/30 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
          {padding}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayVotes = votes.filter(v => v.vote_date === dateStr);
            const myVote = dayVotes.find(v => v.user_id === user?.id)?.status;
            
            const availableCount = dayVotes.filter(v => v.status === 'available').length;
            const maybeCount = dayVotes.filter(v => v.status === 'maybe').length;
            
            // Calculate Heatmap Intensity (Green)
            let bgClass = "bg-background hover:bg-muted/50";
            if (availableCount > 0) {
               const ratio = availableCount / (members.length || 1);
               if (ratio === 1) bgClass = "bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-500/50";
               else if (ratio >= 0.5) bgClass = "bg-emerald-500/20 hover:bg-emerald-500/30";
               else bgClass = "bg-emerald-500/10 hover:bg-emerald-500/20";
            }

            return (
              <div 
                key={dateStr} 
                onClick={() => handleVote(dateStr)}
                className={`h-24 p-2 border border-transparent transition-colors cursor-pointer relative group flex flex-col justify-between ${bgClass}`}
              >
                <div className={`text-sm font-medium ${isToday(day) ? 'bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center' : ''}`}>
                  {format(day, 'd')}
                </div>
                
                {/* Visual Indicators of My Vote & Group Sentiment */}
                <div className="flex flex-col gap-1 w-full mt-1">
                  {myVote && (
                    <div className={`w-full h-1.5 rounded-full ${myVote === 'available' ? 'bg-emerald-500' : myVote === 'maybe' ? 'bg-amber-400' : 'bg-destructive'}`} />
                  )}
                  {availableCount > 0 && <span className="text-[10px] font-semibold text-emerald-600 hidden group-hover:block">{availableCount} Free</span>}
                  {maybeCount > 0 && <span className="text-[10px] font-medium text-amber-600 hidden group-hover:block">{maybeCount} Maybe</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Date Voting Heatmap</h2>
          <p className="text-muted-foreground mt-1">Click days to mark your availability. Dark green days work best for the group!</p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-5 w-5" /></Button>
          <span className="font-medium px-4 text-sm">Scroll Months</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* VOTING LEGEND */}
      <div className="flex flex-wrap gap-6 mb-8 p-4 bg-card border rounded-xl shadow-sm">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-emerald-500" /><span className="text-sm font-medium text-muted-foreground">Available</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-amber-400" /><span className="text-sm font-medium text-muted-foreground">Maybe</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-destructive" /><span className="text-sm font-medium text-muted-foreground">Busy</span></div>
        <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500/30 border border-emerald-500/50" /><span className="text-sm font-medium text-muted-foreground">100% Group Availability (Heatmap)</span></div>
      </div>

      {/* 2-MONTH CALENDAR GRID */}
      <div className="flex flex-col lg:flex-row gap-6 w-full pb-8">
        {renderMonth(currentDate)}
        {renderMonth(addMonths(currentDate, 1))}
      </div>
    </div>
  );
}
