import {
  LayoutDashboard,
  Calendar,
  Lightbulb,
  Clock,
  MapPin,
  PieChart,
  Receipt,
  LucideIcon,
} from "lucide-react";

export type TripSectionKey =
  | "overview"
  | "dates"
  | "ideas"
  | "timeline"
  | "map"
  | "budget"
  | "ledger";

export interface TripSectionItem {
  key: TripSectionKey;
  label: string;
  shortLabel: string;
  path: string;
  icon: LucideIcon;
}

export interface SectionVisibilityMap {
  overview: boolean;
  dates: boolean;
  ideas: boolean;
  timeline: boolean;
  map: boolean;
  budget: boolean;
  ledger: boolean;
}

export interface TripSectionVisibility {
  host: SectionVisibilityMap;
  members: SectionVisibilityMap;
}

export const tripSections: TripSectionItem[] = [
  {
    key: "overview",
    label: "Overview",
    shortLabel: "Overview",
    path: "",
    icon: LayoutDashboard,
  },
  {
    key: "dates",
    label: "Dates",
    shortLabel: "Dates",
    path: "dates",
    icon: Calendar,
  },
  {
    key: "ideas",
    label: "Idea Board",
    shortLabel: "Ideas",
    path: "ideas",
    icon: Lightbulb,
  },
  {
    key: "timeline",
    label: "Timeline",
    shortLabel: "Timeline",
    path: "timeline",
    icon: Clock,
  },
  {
    key: "map",
    label: "Map View",
    shortLabel: "Map",
    path: "map",
    icon: MapPin,
  },
  {
    key: "budget",
    label: "Budget & Forecast",
    shortLabel: "Budget",
    path: "budget",
    icon: PieChart,
  },
  {
    key: "ledger",
    label: "The Ledger",
    shortLabel: "Ledger",
    path: "ledger",
    icon: Receipt,
  },
];

export const DEFAULT_SECTION_MAP: SectionVisibilityMap = {
  overview: true,
  dates: true,
  ideas: true,
  timeline: true,
  map: true,
  budget: true,
  ledger: true,
};

export const DEFAULT_TRIP_SECTION_VISIBILITY: TripSectionVisibility = {
  host: { ...DEFAULT_SECTION_MAP },
  members: { ...DEFAULT_SECTION_MAP },
};

export function normalizeSectionVisibility(
  raw: unknown
): TripSectionVisibility {
  if (!raw || typeof raw !== "object") {
    return {
      host: { ...DEFAULT_SECTION_MAP },
      members: { ...DEFAULT_SECTION_MAP },
    };
  }
  const obj = raw as Record<string, any>;
  const hostRaw = obj.host && typeof obj.host === "object" ? obj.host : {};
  const membersRaw =
    obj.members && typeof obj.members === "object" ? obj.members : {};

  const host: SectionVisibilityMap = { ...DEFAULT_SECTION_MAP };
  const members: SectionVisibilityMap = { ...DEFAULT_SECTION_MAP };

  for (const section of tripSections) {
    if (typeof hostRaw[section.key] === "boolean") {
      host[section.key] = hostRaw[section.key];
    }
    if (typeof membersRaw[section.key] === "boolean") {
      members[section.key] = membersRaw[section.key];
    }
  }

  return { host, members };
}

export function getVisibleSections(
  rawVisibility: unknown,
  isHost: boolean
): TripSectionItem[] {
  const normalized = normalizeSectionVisibility(rawVisibility);
  const targetMap = isHost ? normalized.host : normalized.members;
  const filtered = tripSections.filter((s) => targetMap[s.key] !== false);
  return filtered.length > 0 ? filtered : [tripSections[0]];
}
