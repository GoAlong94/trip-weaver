import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getCachedTripBundle, setCachedTripBundle } from "@/lib/trip-cache";

export interface TripMemberProfile {
  id: string;
  trip_id: string;
  user_id: string;
  role: string;
  status: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

export interface ExpenseSplitRow {
  id?: string;
  expense_id?: string;
  user_id: string;
  amount: number;
}

export interface ExpenseRow {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  paid_by_name?: string;
  date: string;
  created_at?: string;
  splits: ExpenseSplitRow[];
}

interface CachedTripBundle {
  members: TripMemberProfile[];
  expenses: ExpenseRow[];
  ideas: any[];
  timelineEvents: any[];
  dateProposals: any[];
}

export function useTripData(tripId: string | undefined) {
  const { user } = useAuth();
  const initialCache = tripId ? getCachedTripBundle<CachedTripBundle>(tripId) : null;

  const [members, setMembers] = useState<TripMemberProfile[]>(
    () => initialCache?.members || []
  );
  const [expenses, setExpenses] = useState<ExpenseRow[]>(
    () => initialCache?.expenses || []
  );
  const [ideas, setIdeas] = useState<any[]>(() => initialCache?.ideas || []);
  const [timelineEvents, setTimelineEvents] = useState<any[]>(
    () => initialCache?.timelineEvents || []
  );
  const [dateProposals, setDateProposals] = useState<any[]>(
    () => initialCache?.dateProposals || []
  );
  const [loading, setLoading] = useState<boolean>(() => !initialCache);

  const fetchAll = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const cached = getCachedTripBundle<CachedTripBundle>(tripId);
    if (cached) {
      setMembers(cached.members || []);
      setExpenses(cached.expenses || []);
      setIdeas(cached.ideas || []);
      setTimelineEvents(cached.timelineEvents || []);
      setDateProposals(cached.dateProposals || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const [
        membersRes,
        expensesRes,
        ideasRes,
        timelineRes,
        datesRes,
      ] = await Promise.all([
        supabase
          .from("trip_members")
          .select("*, profiles:user_id(id, full_name, email, avatar_url)")
          .eq("trip_id", tripId),
        supabase
          .from("expenses")
          .select("*, expense_splits(*)")
          .eq("trip_id", tripId)
          .order("date", { ascending: false }),
        supabase
          .from("idea_cards")
          .select("*")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false }),
        supabase
          .from("timeline_events")
          .select("*")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true }),
        supabase
          .from("date_proposals")
          .select("*, date_votes(*)")
          .eq("trip_id", tripId)
          .order("start_date", { ascending: true }),
      ]);

      const mappedMembers: TripMemberProfile[] = (membersRes.data || []).map(
        (m: any) => {
          const profile = m.profiles || {};
          return {
            id: m.id,
            trip_id: m.trip_id,
            user_id: m.user_id,
            role: m.role || "Member",
            status: m.status || "accepted",
            name:
              profile.full_name ||
              profile.email?.split("@")[0] ||
              m.display_name ||
              "Trip Member",
            email: profile.email || "",
            avatar_url: profile.avatar_url || null,
          };
        }
      );

      const memberLookup = new Map<string, string>();
      mappedMembers.forEach((m) => memberLookup.set(m.user_id, m.name));

      const mappedExpenses: ExpenseRow[] = (expensesRes.data || []).map(
        (e: any) => ({
          id: e.id,
          trip_id: e.trip_id,
          title: e.title,
          amount: Number(e.amount || 0),
          category: e.category || "Misc",
          paid_by: e.paid_by,
          paid_by_name: memberLookup.get(e.paid_by) || "Member",
          date: e.date || e.created_at || new Date().toISOString(),
          created_at: e.created_at,
          splits: (e.expense_splits || []).map((s: any) => ({
            id: s.id,
            expense_id: s.expense_id,
            user_id: s.user_id,
            amount: Number(s.amount || 0),
          })),
        })
      );

      const nextIdeas = ideasRes.data || [];
      const nextTimeline = timelineRes.data || [];
      const nextDates = datesRes.data || [];

      setMembers(mappedMembers);
      setExpenses(mappedExpenses);
      setIdeas(nextIdeas);
      setTimelineEvents(nextTimeline);
      setDateProposals(nextDates);

      setCachedTripBundle(tripId, {
        members: mappedMembers,
        expenses: mappedExpenses,
        ideas: nextIdeas,
        timelineEvents: nextTimeline,
        dateProposals: nextDates,
      });
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isTripHost = Boolean(
    user &&
      members.some(
        (m) =>
          m.user_id === user.id &&
          typeof m.role === "string" &&
          m.role.toLowerCase() === "host"
      )
  );

  const addExpense = async (payload: {
    title: string;
    amount: number;
    category: string;
    paid_by: string;
    date?: string;
    splits: { user_id: string; amount: number }[];
  }) => {
    if (!tripId) return { error: new Error("Missing trip ID") };

    const { data: expData, error: expError } = await supabase
      .from("expenses")
      .insert({
        trip_id: tripId,
        title: payload.title,
        amount: payload.amount,
        category: payload.category,
        paid_by: payload.paid_by,
        date: payload.date || new Date().toISOString().split("T")[0],
      })
      .select("*")
      .single();

    if (expError || !expData) {
      return { error: expError || new Error("Failed to create expense") };
    }

    if (payload.splits.length > 0) {
      const splitRows = payload.splits.map((s) => ({
        expense_id: expData.id,
        user_id: s.user_id,
        amount: s.amount,
      }));
      await supabase.from("expense_splits").insert(splitRows);
    }

    await fetchAll();
    return { data: expData, error: null };
  };

  const deleteExpense = async (expenseId: string) => {
    const previous = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId);

    if (error) {
      setExpenses(previous);
      return { error };
    }

    await fetchAll();
    return { error: null };
  };

  return {
    members,
    expenses,
    ideas,
    timelineEvents,
    dateProposals,
    loading,
    isTripHost,
    refresh: fetchAll,
    addExpense,
    deleteExpense,
  };
}
