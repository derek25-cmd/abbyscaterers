import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  ChefHat,
  ClipboardList,
  Home,
  Package,
  Settings,
  Users,
  Utensils,
  FileText
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Orders", url: "/orders", icon: ClipboardList },
  { title: "Menu", url: "/menu", icon: Utensils },
  { title: "Events", url: "/events", icon: Calendar },
  { title: "Customers", url: "/customers", icon: Users },
];

const managementItems = [
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Staff", url: "/staff", icon: ChefHat },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Invoices", url: "/invoices", icon: FileText },
];

const systemItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => {
    return path === "/" ? currentPath === "/" : currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClasses = "w-full justify-start transition-smooth";
    return isActive(path)
      ? `${baseClasses} bg-primary text-primary-foreground shadow-elegant`
      : `${baseClasses} hover:bg-accent`;
  };

  const renderNavGroup = (items: typeof mainNavItems, label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground font-medium">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} className={getNavClassName(item.url)}>
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className="border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-card">
      <SidebarContent className="gap-6 p-4">
        {/* Brand Section */}
        {!collapsed && (
          <div className="px-2 pb-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded bg-gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-xs">CT</span>
              </div>
              <span className="font-semibold text-sm">CaterTrax Pro</span>
            </div>
          </div>
        )}
        
        {renderNavGroup(mainNavItems, "Main")}
        {renderNavGroup(managementItems, "Management")}
        {renderNavGroup(systemItems, "System")}
      </SidebarContent>
    </Sidebar>
  );
}