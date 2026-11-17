import type { Tables } from '@/integrations/supabase/types';

type Trip = Tables<'trips'>;

const CACHE_PREFIX = 'plansplit:trip-cache:';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface TripCache {
  savedAt: number;
  trips: Trip[];
}

export function readTripCache(userId: string, now = Date.now()): Trip[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;

    const cache: unknown = JSON.parse(raw);
    if (
      typeof cache !== 'object' ||
      cache === null ||
      !('savedAt' in cache) ||
      typeof cache.savedAt !== 'number' ||
      !('trips' in cache) ||
      !Array.isArray(cache.trips) ||
      now - cache.savedAt > CACHE_TTL_MS ||
      cache.savedAt > now
    ) {
      localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
      return null;
    }

    return cache.trips as Trip[];
  } catch {
    return null;
  }
}

export function writeTripCache(userId: string, trips: Trip[], now = Date.now()): void {
  try {
    const cache: TripCache = { savedAt: now, trips };
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(cache));
  } catch {
    // Caching is optional; authenticated server data remains authoritative.
  }
}