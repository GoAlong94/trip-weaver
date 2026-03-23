export interface User {
  id: string;
  name: string;
  avatar_url: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  created_by: string;
  cover_emoji: string;
}

export type MemberRole = 'Host' | 'Member';

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: MemberRole;
}
