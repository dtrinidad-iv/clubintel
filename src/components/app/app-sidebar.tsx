import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { unreadAlertCount } from "@/lib/alerts";
import { listMyWorkspaces, requireWorkspace } from "@/lib/dal";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { WorkspaceSwitcher } from "./workspace-switcher";

export async function AppSidebar() {
  const [{ user, workspace }, workspaces, unreadAlerts] = await Promise.all([requireWorkspace(), listMyWorkspaces(), unreadAlertCount()]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher current={{ id: workspace.id, name: workspace.name, role: workspace.role }} workspaces={workspaces} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain unreadAlerts={unreadAlerts} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
