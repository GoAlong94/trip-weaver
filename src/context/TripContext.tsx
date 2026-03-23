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
  updateTrip: (id: string, updates: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
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
    if (authLoading) return; 
    
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

  useEffect(() => { 
      fetchTrips(); 
  }, [fetchTrips]);

  const getTrip = useCallback((id: string) => trips.find(t => t.id === id), [trips]);

  const updateTrip = async (id: string, updates: Partial<Trip>) => {
    try {
      const { error } = await supabase.from('trips').update(updates).eq('id', id);
      if (error) throw error;
      
      // Update local state instantly
      setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success('Trip updated');
    } catch (error: any) {
      console.error('Error updating trip:', error);
      toast.error(error.message || 'Failed to update trip');
      throw error;
    }
  };

  const deleteTrip = async (id: string) => {
    try {
      // Because we have foreign keys (trip_members, idea_cards), Supabase handles cascading deletes 
      // if configured, otherwise we just delete the trip and let RLS block access to orphans.
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) throw error;

      // Remove from local state
      setTrips(prev => prev.filter(t => t.id !== id));
      toast.success('Trip deleted');
    } catch (error: any) {
      console.error('Error deleting trip:', error);
      toast.error(error.message || 'Failed to delete trip');
      throw error;
    }
  };

  return (
    <TripContext.Provider value={{ trips, loading, getTrip, refetch: fetchTrips, updateTrip, deleteTrip }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrips must be inside TripProvider');
  return ctx;
}
