import { useParams } from 'react-router-dom';
import { useTrips } from '@/context/TripContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';

export default function Overview() {
  const { tripId } = useParams();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId || '');
  if (!trip) return null;

  const days = differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date));

  const stats = [
    { label: 'Destination', value: trip.start_destination, icon: MapPin },
    { label: 'Duration', value: `${days} days`, icon: Clock },
    { label: 'Dates', value: `${format(parseISO(trip.start_date), 'MMM d')} – ${format(parseISO(trip.end_date), 'MMM d, yyyy')}`, icon: Calendar },
    { label: 'Members', value: '—', icon: Users },
  ];

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-display font-bold mb-6">Trip Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-foreground font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
