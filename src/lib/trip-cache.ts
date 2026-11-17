const TRIPS_LIST_KEY = "wanderloom:trips-list:v1";
const TRIP_DETAIL_PREFIX = "wanderloom:trip-data:v1:";
const LAST_ROUTE_KEY = "wanderloom:last-route:v1";

const memoryCache = new Map<string, unknown>();

export function readCache<T>(key: string): T | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  memoryCache.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedTrips<T = any[]>(): T | null {
  return readCache<T>(TRIPS_LIST_KEY);
}

export function setCachedTrips<T = any[]>(trips: T): void {
  writeCache(TRIPS_LIST_KEY, trips);
}

export function getCachedTripBundle<T = any>(tripId: string): T | null {
  if (!tripId) return null;
  return readCache<T>(`${TRIP_DETAIL_PREFIX}${tripId}`);
}

export function setCachedTripBundle<T = any>(tripId: string, bundle: T): void {
  if (!tripId) return;
  writeCache(`${TRIP_DETAIL_PREFIX}${tripId}`, bundle);
}

export function setLastActiveRoute(path: string): void {
  if (!path || path === "/" || path.startsWith("/auth")) return;
  writeCache(LAST_ROUTE_KEY, path);
}

export function getLastActiveRoute(): string | null {
  return readCache<string>(LAST_ROUTE_KEY);
}
