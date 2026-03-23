import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trip } from '@/types/trip';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface TripContextType {
  trips: Trip[];
  loading: boolean;
  refreshTrips: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const { session, loading: authLoading } = useAuth(); // Depend on Auth state

  const fetchTrips = async () => {
    // If auth is still loading, wait. If no session, stop loading immediately.
    if (authLoading) return;
    if (!session?.user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error: any) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false); // ALWAYS turn off loading
    }
  };

  // Re-run fetchTrips whenever the auth session changes
  useEffect(() => {
    fetchTrips();
  }, [session, authLoading]);

  return (
    <TripContext.Provider value={{ trips, loading, refreshTrips: fetchTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrips = () => {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrips must be used within a TripProvider');
  }
  return context;
};
