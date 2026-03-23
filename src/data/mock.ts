import { User, Trip, TripMember } from '@/types/trip';

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Chen',
  avatar_url: '',
};

export const mockUsers: User[] = [
  currentUser,
  { id: 'u2', name: 'Priya Sharma', avatar_url: '' },
  { id: 'u3', name: 'Marcus Johnson', avatar_url: '' },
];

export const mockTrips: Trip[] = [
  {
    id: 't1',
    title: 'Tokyo Adventure',
    destination: 'Tokyo, Japan',
    start_date: '2026-04-10',
    end_date: '2026-04-20',
    created_by: 'u1',
    cover_emoji: '🗼',
  },
  {
    id: 't2',
    title: 'Barcelona Getaway',
    destination: 'Barcelona, Spain',
    start_date: '2026-06-01',
    end_date: '2026-06-08',
    created_by: 'u1',
    cover_emoji: '🏖️',
  },
  {
    id: 't3',
    title: 'NYC Weekend',
    destination: 'New York, USA',
    start_date: '2025-12-20',
    end_date: '2025-12-23',
    created_by: 'u2',
    cover_emoji: '🗽',
  },
];

export const mockMembers: TripMember[] = [
  { id: 'm1', trip_id: 't1', user_id: 'u1', role: 'Host' },
  { id: 'm2', trip_id: 't1', user_id: 'u2', role: 'Member' },
  { id: 'm3', trip_id: 't2', user_id: 'u1', role: 'Host' },
  { id: 'm4', trip_id: 't3', user_id: 'u2', role: 'Host' },
  { id: 'm5', trip_id: 't3', user_id: 'u1', role: 'Member' },
];
