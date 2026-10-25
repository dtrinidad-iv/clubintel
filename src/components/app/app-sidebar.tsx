import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { listMyWorkspaces, requireWorkspace } from "@/lib/dal";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { WorkspaceSwitcher } from "./workspace-switcher";

export async function AppSidebar() {
  const [{ user, workspace }, workspaces] = await Promise.all([requireWorkspace(), listMyWorkspaces()]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher current={{ id: workspace.id, name: workspace.name, role: workspace.role }} workspaces={workspaces} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
