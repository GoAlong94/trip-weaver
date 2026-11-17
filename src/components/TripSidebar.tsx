import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { tripSections } from '@/lib/trip-sections';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export default function TripSidebar({ visibleSections }: { visibleSections: typeof tripSections[number][] }) {
  const { tripId } = useParams();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/dashboard" className="hover:bg-sidebar-accent/50" activeClassName="">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    <span>All Trips</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSections.map((tab) => (
                <SidebarMenuItem key={tab.path}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/trip/${tripId}/${tab.path}`}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <tab.icon className="mr-2 h-4 w-4" />
                      <span>{tab.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
