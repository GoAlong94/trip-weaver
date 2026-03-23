import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Trip = Tables<'trips'>;

interface TripContextValue {
  trips: Trip[];
  loading: boolean;
  addTrip: (data: { title: string; start_destination: string; start_date: string; end_date: string }) => Promise<Trip>;
  getTrip: (id: string) => Trip | undefined;
  refetch: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

const emojis = ['✈️', '🌍', '🏔️', '🌴', '🚢', '🏕️', '🎒', '🗺️'];

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    if (!user) { setTrips([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    setTrips(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const addTrip = useCallback(async (data: { title: string; start_destination: string; start_date: string; end_date: string }) => {
    if (!user) throw new Error('Not authenticated');
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        title: data.title,
        start_destination: data.start_destination,
        start_date: data.start_date,
        end_date: data.end_date,
        created_by: user.id,
        cover_emoji: emoji,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-add creator as Host
    await supabase.from('trip_members').insert({
      trip_id: trip.id,
      user_id: user.id,
      role: 'Host',
    });

    setTrips(prev => [trip, ...prev]);
    return trip;
  }, [user]);

  const getTrip = useCallback((id: string) => trips.find(t => t.id === id), [trips]);

  return (
    <TripContext.Provider value={{ trips, loading, addTrip, getTrip, refetch: fetchTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrips must be inside TripProvider');
  return ctx;
}
