import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getCachedTrips, setCachedTrips } from "@/lib/trip-cache";
import {
  TripSectionVisibility,
  normalizeSectionVisibility,
} from "@/lib/trip-sections";

export interface TripRecord {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  invite_code: string | null;
  created_by: string;
  created_at?: string;
  section_visibility?: TripSectionVisibility | null;
  member_count?: number;
}

interface TripContextType {
  trips: TripRecord[];
  loading: boolean;
  refreshTrips: () => Promise<void>;
  getTrip: (id: string) => TripRecord | undefined;
  createTrip: (data: {
    name: string;
    destination?: string;
    start_date?: string | null;
    end_date?: string | null;
    cover_image?: string | null;
  }) => Promise<TripRecord | null>;
  updateTrip: (id: string, updates: Partial<TripRecord>) => Promise<boolean>;
  updateTripSectionVisibility: (
    tripId: string,
    visibility: TripSectionVisibility
  ) => Promise<boolean>;
  deleteTrip: (id: string) => Promise<boolean>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripRecord[]>(() => getCachedTrips<TripRecord[]>() || []);
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getCachedTrips<TripRecord[]>();
    return !cached || cached.length === 0;
  });

  const refreshTrips = useCallback(async () => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const cached = getCachedTrips<TripRecord[]>();
    if (!cached || cached.length === 0) {
      setLoading(true);
    }

    try {
      const { data: memberRows } = await supabase
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", user.id);

      const memberTripIds = (memberRows || []).map((r: any) => r.trip_id);

      let query = supabase
        .from("trips")
        .select("*, trip_members(count)")
        .order("created_at", { ascending: false });

      if (memberTripIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${memberTripIds.join(",")})`);
      } else {
        query = query.eq("created_by", user.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        const normalized: TripRecord[] = data.map((row: any) => ({
          ...row,
          section_visibility: normalizeSectionVisibility(row.section_visibility),
          member_count: Array.isArray(row.trip_members)
            ? row.trip_members[0]?.count ?? 1
            : 1,
        }));
        setTrips(normalized);
        setCachedTrips(normalized);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTrips();
  }, [refreshTrips]);

  const getTrip = useCallback(
    (id: string) => trips.find((t) => t.id === id),
    [trips]
  );

  const createTrip = async (input: {
    name: string;
    destination?: string;
    start_date?: string | null;
    end_date?: string | null;
    cover_image?: string | null;
  }): Promise<TripRecord | null> => {
    if (!user) return null;
    const payload = {
      name: input.name,
      destination: input.destination || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      cover_image: input.cover_image || null,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from("trips")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) return null;

    await supabase.from("trip_members").upsert(
      {
        trip_id: data.id,
        user_id: user.id,
        role: "Host",
        status: "accepted",
      },
      { onConflict: "trip_id,user_id" }
    );

    const created: TripRecord = {
      ...data,
      section_visibility: normalizeSectionVisibility((data as any).section_visibility),
      member_count: 1,
    };

    setTrips((prev) => {
      const next = [created, ...prev.filter((t) => t.id !== created.id)];
      setCachedTrips(next);
      return next;
    });

    return created;
  };

  const updateTrip = async (
    id: string,
    updates: Partial<TripRecord>
  ): Promise<boolean> => {
    const previous = trips;
    const optimistic = trips.map((t) => (t.id === id ? { ...t, ...updates } : t));
    setTrips(optimistic);
    setCachedTrips(optimistic);

    const { error } = await supabase
      .from("trips")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      setTrips(previous);
      setCachedTrips(previous);
      return false;
    }
    return true;
  };

  const updateTripSectionVisibility = async (
    tripId: string,
    visibility: TripSectionVisibility
  ): Promise<boolean> => {
    return updateTrip(tripId, { section_visibility: visibility });
  };

  const deleteTrip = async (id: string): Promise<boolean> => {
    const previous = trips;
    const next = trips.filter((t) => t.id !== id);
    setTrips(next);
    setCachedTrips(next);

    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) {
      setTrips(previous);
      setCachedTrips(previous);
      return false;
    }
    return true;
  };

  return (
    <TripContext.Provider
      value={{
        trips,
        loading,
        refreshTrips,
        getTrip,
        createTrip,
        updateTrip,
        updateTripSectionVisibility,
        deleteTrip,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export function useTrips() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrips must be used within a TripProvider");
  return ctx;
}
