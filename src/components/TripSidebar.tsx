import React from "react";
import { NavLink, Link } from "react-router-dom";
import { ArrowLeft, Plane, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { TripRecord } from "@/context/TripContext";
import { TripSectionItem } from "@/lib/trip-sections";

export interface TripSidebarProps {
  trip: TripRecord;
  sections: TripSectionItem[];
  isHost: boolean;
  settingsSlot?: React.ReactNode;
}

export function TripSidebar({
  trip,
  sections,
  isHost,
  settingsSlot,
}: TripSidebarProps) {
  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarHeader className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Trips
          </Link>
          {isHost && settingsSlot}
        </div>

        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Plane className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm truncate">{trip.name}</h2>
            {trip.destination && (
              <p className="text-xs text-muted-foreground truncate">
                {trip.destination}
              </p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trip Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => {
                const Icon = section.icon;
                const to = section.path
                  ? `/trip/${trip.id}/${section.path}`
                  : `/trip/${trip.id}`;

                return (
                  <SidebarMenuItem key={section.key}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={to}
                        end={section.path === ""}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-primary/15 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{section.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {trip.member_count || 1} members
          </span>
          <span className="font-medium text-primary">
            {isHost ? "Host" : "Member"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default TripSidebar;
