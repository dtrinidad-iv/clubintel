"use client";

import { Bell, FileText, Handshake, LayoutDashboard, Settings, Shield, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Opportunities", href: "/opportunities", icon: Handshake },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Clubs", href: "/clubs", icon: Shield },
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Alerts", href: "/alerts", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
];

// unreadAlerts comes from the server sidebar, so refresh() after marking alerts read updates it.
export function NavMain({ unreadAlerts }: { unreadAlerts: number }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.title}>
              <Link href={item.href} onClick={() => setOpenMobile(false)}>
                <item.icon />
                <span>{item.title}</span>
                {item.href === "/alerts" && unreadAlerts > 0 && <span className="sr-only">, {unreadAlerts} unread</span>}
              </Link>
            </SidebarMenuButton>
            {item.href === "/alerts" && unreadAlerts > 0 && (
              <SidebarMenuBadge aria-hidden data-testid="alerts-badge">
                {unreadAlerts > 99 ? "99+" : unreadAlerts}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
