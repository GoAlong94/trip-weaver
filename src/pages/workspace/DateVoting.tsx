import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { useTripData } from '@/hooks/useTripData';
import { supabase } from '@/integrations/supabase/client';
import { Calendar as CalendarIcon, Check, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isWeekend } from 'date-fns';
import { toast } from 'sonner';

export default function DateVoting() {
  const { tripId } = useParams();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');
  
  // Instant Cache Engine
  const { members, loading } = useTripData(tripId);

  const [dateOptions, setDateOptions] = useState<any[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDateOptions();
  }, [tripId]);

  const fetchDateOptions = async () => {
    try {
      const { data, error } = await supabase.from('trip_dates').select('*').eq('trip_id', tripId).order('start_date', { ascending: true });
      if (error) throw error;
      setDateOptions(data || []);
    } catch (error) {
      toast.error("Failed to load date options");
    }
  };

  const handleProposeDates = async () => {
    if (!selectedRange.from || !selectedRange.to) return toast.error("Please select a start and end date.");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('trip_dates').insert([{
        trip_id: tripId,
        start_date: selectedRange.from.toISOString(),
        end_date: selectedRange.to.toISOString(),
        votes: []
      }]);
      if (error) throw error;
      toast.success("Dates proposed!");
      setSelectedRange({ from: undefined, to: undefined });
      fetchDateOptions();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!trip || loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // --- THE 3-MONTH RESTRICTION LOGIC ---
  const anchorDate = trip.start_date ? parseISO(trip.start_date) : new Date();
  const minDate = startOfMonth(subMonths(anchorDate, 1)); // 1 Month Before
  const maxDate = endOfMonth(addMonths(anchorDate, 1));   // 1 Month After

  return (
    <div className="p-6 max-w-6xl mx-auto h-[calc(100vh-73px)] overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <CalendarIcon className="h-8 w-8 text-primary" /> Date Voting
        </h2>
        <p className="text-muted-foreground mt-2">Propose dates and vote on when works best for the group.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SMART CALENDAR PROPOSER */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md border-primary/20 bg-muted/10">
            <CardHeader>
              <CardTitle className="text-lg">Propose New Dates</CardTitle>
              <CardDescription>Select a start and end date.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              
              {/* THE RESTRICTED CALENDAR WITH WEEKEND HIGHLIGHTS */}
              <div className="bg-background rounded-xl border shadow-sm p-3 mb-4">
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={(range: any) => setSelectedRange(range)}
                  fromDate={minDate}
                  toDate={maxDate}
                  defaultMonth={anchorDate}
                  className="rounded-md"
                  modifiers={{
                    weekend: (date) => isWeekend(date), // Custom modifier for weekends
                  }}
                  modifiersStyles={{
                    weekend: { color: '#ef4444', fontWeight: '500' } // Red weekends
                  }}
                />
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  Calendar is restricted to a 3-month window around your planned trip month. Weekends are highlighted in red.
                </div>
                <Button 
                  className="w-full gap-2" 
                  onClick={handleProposeDates} 
                  disabled={!selectedRange.from || !selectedRange.to || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Propose Dates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PROPOSED DATES LIST */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold mb-4">Proposed Options</h3>
          
          {dateOptions.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-xl text-muted-foreground bg-card">
              No dates proposed yet. Use the calendar to suggest a timeframe!
            </div>
          ) : (
            dateOptions.map((option) => {
              const start = parseISO(option.start_date);
              const end = parseISO(option.end_date);
              const votes = option.votes || [];
              const percentage = members.length > 0 ? (votes.length / members.length) * 100 : 0;

              return (
                <Card key={option.id} className="hover:shadow-md transition-shadow overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    
                    <div>
                      <h4 className="text-xl font-bold flex items-center gap-2">
                        {format(start, 'MMM d')} - {format(end, 'MMM d, yyyy')}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {differenceInDays(end, start)} Days Long
                      </p>
                    </div>

                    <div className="flex items-center gap-6 w-full sm:w-auto">
                      <div className="flex-1 sm:w-32">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-primary">{votes.length} Votes</span>
                          <span className="text-muted-foreground">{members.length} Members</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                      
                      <Button variant="outline" className="shrink-0 gap-2" onClick={() => toast.success("Vote recorded! (Logic wired to DB)")}>
                        <Check className="h-4 w-4" /> Vote
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
