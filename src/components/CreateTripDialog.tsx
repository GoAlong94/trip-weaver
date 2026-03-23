import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const emojis = ['✈️', '🌍', '🏔️', '🌴', '🚢', '🏕️', '🎒', '🗺️'];

export default function CreateTripDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { refetch } = useTrips();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Form State
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const resetForm = () => {
    setTitle('');
    setDestination('');
    setStartDate('');
    setEndDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast.error("Authentication required.");
        return;
    }

    setIsSubmitting(true);

    try {
      const fallbackDate = new Date().toISOString().split('T')[0];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert([
          {
            title: title.trim(),
            start_destination: destination.trim(),
            start_date: startDate || fallbackDate,
            end_date: endDate || fallbackDate,
            created_by: user.id,
            cover_emoji: emoji
          }
        ])
        .select()
        .single();

      if (tripError) throw tripError;

      const { error: memberError } = await supabase
        .from('trip_members')
        .insert([
          {
            trip_id: tripData.id,
            user_id: user.id,
            role: 'Host'
          }
        ]);

      if (memberError) throw memberError;

      toast.success('Trip created successfully!');
      
      if (!isMounted.current) return;

      // Ensure we trigger the global context refresh BEFORE unmounting/navigating
      if (typeof refetch === 'function') {
         await refetch();
      }

      resetForm();
      setOpen(false);
      
      // Defer navigation slightly to ensure modal closes and React tree stabilizes
      setTimeout(() => {
          if (isMounted.current) {
              navigate(`/trip/${tripData.id}/overview`);
          }
      }, 50);
      
    } catch (error: any) {
      console.error("Trip creation failed:", error);
      toast.error(error?.message || 'Failed to create trip');
    } finally {
      if (isMounted.current) {
          setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
        if (!isSubmitting) setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Trip</DialogTitle>
          <DialogDescription>
            Give your adventure a name and starting point.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Trip Name</Label>
            <Input 
              id="title" 
              placeholder="e.g. Summer in Himachal" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">Starting Destination</Label>
            <Input 
              id="destination" 
              placeholder="e.g. Chandigarh" 
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input 
                id="startDate" 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
