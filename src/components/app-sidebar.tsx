import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Calendar, Users, CheckSquare, Scale, Gavel } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Cases", url: "/cases", icon: Briefcase },
  { title: "Cause List", url: "/calendar", icon: Calendar },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Associates", url: "/associates", icon: Users },
  { title: "FCC Judgments", url: "/fcc-judgments", icon: Gavel },
] as const;

export function AppSidebar({ isAdmin: _isAdmin }: { isAdmin: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: r => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-md bg-brass text-brass-foreground flex items-center justify-center shrink-0">
            <Scale className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-serif text-base text-sidebar-foreground">ZLC Digital</div>
              <div className="text-[10px] text-sidebar-foreground/70 uppercase tracking-wider">Zakariya Law Chambers</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
