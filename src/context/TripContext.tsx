import React, { createContext, useContext, useState, useCallback } from 'react';
import { Trip, User } from '@/types/trip';
import { mockTrips, currentUser } from '@/data/mock';

interface TripContextValue {
  user: User;
  trips: Trip[];
  addTrip: (trip: Omit<Trip, 'id' | 'created_by' | 'cover_emoji'>) => Trip;
  getTrip: (id: string) => Trip | undefined;
}

const TripContext = createContext<TripContextValue | null>(null);

const emojis = ['✈️', '🌍', '🏔️', '🌴', '🚢', '🏕️', '🎒', '🗺️'];

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>(mockTrips);

  const addTrip = useCallback((data: Omit<Trip, 'id' | 'created_by' | 'cover_emoji'>) => {
    const newTrip: Trip = {
      ...data,
      id: `t${Date.now()}`,
      created_by: currentUser.id,
      cover_emoji: emojis[Math.floor(Math.random() * emojis.length)],
    };
    setTrips(prev => [newTrip, ...prev]);
    return newTrip;
  }, []);

  const getTrip = useCallback((id: string) => trips.find(t => t.id === id), [trips]);

  return (
    <TripContext.Provider value={{ user: currentUser, trips, addTrip, getTrip }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrips must be inside TripProvider');
  return ctx;
}
