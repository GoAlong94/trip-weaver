import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global memory cache. This survives when you switch tabs!
const globalCache: Record<string, any> = {};
let isFetching = false; // Prevents colliding fetch requests

export function useTripData(tripId: string | undefined) {
  const [members, setMembers] = useState<any[]>(globalCache[`${tripId}_members`] || []);
  const [ideas, setIdeas] = useState<any[]>(globalCache[`${tripId}_ideas`] || []);
  const [expenses, setExpenses] = useState<any[]>(globalCache[`${tripId}_expenses`] || []);
  
  // Only show the loading spinner if the cache is completely empty
  const [loading, setLoading] = useState(!globalCache[`${tripId}_members`]);

  const refreshData = useCallback(async () => {
    if (!tripId || isFetching) return;
    isFetching = true;
    
    try {
      const [membersRes, ideasRes, expensesRes] = await Promise.all([
        supabase.from('trip_members').select('user_id, role').eq('trip_id', tripId),
        supabase.from('idea_cards').select('*').eq('trip_id', tripId),
        supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
      ]);

      let enrichedMembers = [];
      if (membersRes.data && membersRes.data.length > 0) {
        const userIds = membersRes.data.map((m: any) => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

        enrichedMembers = membersRes.data.map((m: any) => ({
          ...m,
          profiles: profileMap.get(m.user_id) || null
        }));
      }

      globalCache[`${tripId}_members`] = enrichedMembers;
      globalCache[`${tripId}_ideas`] = ideasRes.data || [];
      globalCache[`${tripId}_expenses`] = expensesRes.data || [];

      setMembers(enrichedMembers);
      setIdeas(ideasRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (error) {
      console.error("Failed to fetch trip data", error);
    } finally {
      setLoading(false);
      isFetching = false;
    }
  }, [tripId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return { members, ideas, expenses, loading, refreshData };
}
