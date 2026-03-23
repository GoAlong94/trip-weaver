import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Trip = Tables<'trips'>;

interface TripContextValue {
  trips: Trip[];
  loading: boolean;
  getTrip: (id: string) => Trip | undefined;
  refetch: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchTrips = useCallback(async () => {
    if (authLoading) return; // Wait for auth to settle
    
    if (!user) { 
        if (isMounted.current) {
            setTrips([]); 
            setLoading(false); 
        }
        return; 
    }

    try {
        if (isMounted.current) setLoading(true);
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (isMounted.current) {
            setTrips(data || []);
        }
    } catch (error) {
        console.error("Error fetching trips:", error);
    } finally {
        if (isMounted.current) setLoading(false);
    }
  }, [user, authLoading]);

  // Refetch when user changes
  useEffect(() => { 
      fetchTrips(); 
  }, [fetchTrips]);

  const getTrip = useCallback((id: string) => trips.find(t => t.id === id), [trips]);

  return (
    <TripContext.Provider value={{ trips, loading, getTrip, refetch: fetchTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrips must be inside TripProvider');
  return ctx;
}
