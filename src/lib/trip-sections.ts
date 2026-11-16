import {
  CalendarDays,
  Clock,
  LayoutDashboard,
  Lightbulb,
  MapIcon,
  PieChart,
  Receipt,
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

export const tripSections = [
  { title: 'Overview', path: 'overview', key: 'overview', icon: LayoutDashboard },
  { title: 'Dates', path: 'dates', key: 'dates', icon: CalendarDays },
  { title: 'Idea Board', path: 'ideas', key: 'ideas', icon: Lightbulb },
  { title: 'Timeline', path: 'timeline', key: 'timeline', icon: Clock },
  { title: 'Map View', path: 'map', key: 'map', icon: MapIcon },
  { title: 'Budget & Forecast', path: 'budget', key: 'budget', icon: PieChart },
  { title: 'The Ledger', path: 'ledger', key: 'ledger', icon: Receipt },
] as const;

export type TripSectionKey = (typeof tripSections)[number]['key'];
export type SectionVisibility = Record<TripSectionKey, boolean>;
export type TripSectionVisibility = { host: SectionVisibility; members: SectionVisibility };

export const allSectionsVisible: SectionVisibility = {
  overview: true,
  dates: true,
  ideas: true,
  timeline: true,
  map: true,
  budget: true,
  ledger: true,
};

export function readSectionVisibility(value: Json | null | undefined): TripSectionVisibility {
  const parsed = value && typeof value === 'object' && !Array.isArray(value)
    ? value as { [key: string]: Json | undefined }
    : {};
  const readGroup = (group: Json | undefined): SectionVisibility => {
    const settings = group && typeof group === 'object' && !Array.isArray(group)
      ? group as { [key: string]: Json | undefined }
      : {};

    return tripSections.reduce((result, section) => {
      result[section.key] = typeof settings[section.key] === 'boolean'
        ? settings[section.key] as boolean
        : true;
      return result;
    }, { ...allSectionsVisible });
  };

  return { host: readGroup(parsed.host), members: readGroup(parsed.members) };
}