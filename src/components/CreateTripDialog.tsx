import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

export default function CreateTripDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { addTrip } = useTrips();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !destination || !startDate || !endDate) return;
    const trip = addTrip({ title, destination, start_date: startDate, end_date: endDate });
    setOpen(false);
    setTitle(''); setDestination(''); setStartDate(''); setEndDate('');
    navigate(`/trip/${trip.id}/overview`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-warm text-primary-foreground shadow-warm gap-2 font-semibold">
          <Plus className="h-4 w-4" /> New Trip
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create a new trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Trip Title</Label>
            <Input id="title" placeholder="e.g. Summer in Bali" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dest">Destination</Label>
            <Input id="dest" placeholder="e.g. Bali, Indonesia" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start Date</Label>
              <Input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End Date</Label>
              <Input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full gradient-warm text-primary-foreground shadow-warm font-semibold">
            Create Trip
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
