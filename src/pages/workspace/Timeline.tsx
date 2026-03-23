import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, EyeOff, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function Timeline() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const [scheduledIdeas, setScheduledIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [tripId]);

  const fetchTimeline = async () => {
    try {
      const { data, error } = await supabase
        .from('idea_cards')
        .select('*')
        .eq('trip_id', tripId)
        .not('start_time', 'is', null) // Only fetch items that have a time scheduled
        .order('start_time', { ascending: true });

      if (error) throw error;
      setScheduledIdeas(data || []);
    } catch (error: any) {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert 24h SQL time to readable 12h format
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; 
    return `${h}:${minutes} ${ampm}`;
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Daily Itinerary</h2>
        <p className="text-muted-foreground mt-1">Visualize your schedule and adjust time blocks.</p>
      </div>

      {scheduledIdeas.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">Nothing scheduled yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Go to the Idea Board, click on an idea, and assign it a Start Time and End Time to see it on the timeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          
          {scheduledIdeas.map((item, index) => {
            // Privacy filter: Hide private items if current user didn't create them
            if (item.visibility === 'private' && item.created_by !== user?.id) return null;

            return (
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Timeline dot */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <Clock className="h-4 w-4" />
                </div>
                
                {/* Event Card */}
                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-primary">
                        {formatTime(item.start_time)} {item.end_time && `- ${formatTime(item.end_time)}`}
                      </span>
                      {item.visibility === 'private' ? (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 gap-1"><EyeOff className="h-3 w-3"/> Private</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Users className="h-3 w-3"/> Group</Badge>
                      )}
                    </div>
                    
                    <h4 className="text-lg font-bold">{item.title}</h4>
                    
                    <div className="flex justify-between items-end mt-4">
                      <Badge variant={item.category === 'Food' ? 'default' : 'secondary'}>{item.category}</Badge>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block">Estimated Cost</span>
                        <span className="font-semibold">₹{item.quantity * item.unit_cost}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
