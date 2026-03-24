import { useParams } from 'react-router-dom';
import { LayoutDashboard, Lightbulb, Clock, TrendingUp, Receipt, ArrowLeft, CalendarDays } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const tabs = [
  { title: 'Overview', path: 'overview', icon: LayoutDashboard },
  { title: 'Dates', path: 'dates', icon: CalendarDays },
  { title: 'Idea Board', path: 'ideas', icon: Lightbulb },
  { title: 'Timeline', path: 'timeline', icon: Clock },
  { title: 'Forecast', path: 'forecast', icon: TrendingUp },
  { title: 'Ledger', path: 'ledger', icon: Receipt },
];

export default function TripSidebar() {
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
              {tabs.map((tab) => (
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
