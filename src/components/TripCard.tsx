import { useNavigate } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import { Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type Trip = Tables<'trips'>;

export default function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const navigate = useNavigate();
  const past = isPast(parseISO(trip.end_date));

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      onClick={() => navigate(`/trip/${trip.id}/overview`)}
      className={`group text-left w-full rounded-xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${past ? 'opacity-60' : ''}`}
    >
      <div className="text-4xl mb-3">{trip.cover_emoji}</div>
      <h3 className="font-display text-lg font-semibold text-card-foreground mb-1 group-hover:text-primary transition-colors">
        {trip.title}
      </h3>
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-2">
        <MapPin className="h-3.5 w-3.5" />
        {trip.start_destination}
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Calendar className="h-3 w-3" />
        {format(parseISO(trip.start_date), 'MMM d')} – {format(parseISO(trip.end_date), 'MMM d, yyyy')}
      </div>
      {past && (
        <span className="mt-3 inline-block text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          Completed
        </span>
      )}
    </motion.button>
  );
}
