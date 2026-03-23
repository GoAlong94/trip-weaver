import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/context/TripContext';
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

export default function CreateTripDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { addTrip } = useTrips(); // Using your context's built-in function
  const navigate = useNavigate();

  // Form State
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('You must be logged in to create a trip.');

      // Provide fallback dates if the user left them empty to satisfy DB requirements
      const fallbackDate = new Date().toISOString().split('T')[0];

      // addTrip handles the database insert AND the React state update!
      const newTrip = await addTrip({
        title,
        start_destination: destination,
        start_date: startDate || fallbackDate,
        end_date: endDate || fallbackDate,
      });

      toast.success('Trip created successfully!');
      
      // Clear form and close modal
      setTitle(''); setDestination(''); setStartDate(''); setEndDate('');
      setOpen(false);
      
      // Navigate to the new workspace!
      navigate(`/trip/${newTrip.id}/overview`);
      
    } catch (error: any) {
      console.error("Trip creation error:", error);
      toast.error(error.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input 
                id="endDate" 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
