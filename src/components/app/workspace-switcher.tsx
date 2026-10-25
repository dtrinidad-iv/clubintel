"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { Role } from "@/lib/dal";
import { initials, roleLabel } from "@/lib/format";
import { switchWorkspace } from "@/lib/workspace-actions";

type WorkspaceOption = { id: string; name: string; role: Role };

export function WorkspaceSwitcher({ current, workspaces }: { current: WorkspaceOption; workspaces: WorkspaceOption[] }) {
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Switch workspace" disabled={pending}>
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                {initials(current.name)}
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium" data-testid="current-workspace">
                  {current.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{roleLabel(current.role)}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-64" align="start" side={isMobile ? "bottom" : "right"}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => ws.id !== current.id && startTransition(() => switchWorkspace(ws.id))}
              >
                <span className="flex size-6 items-center justify-center rounded-md border text-[10px] font-semibold">
                  {initials(ws.name)}
                </span>
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.id === current.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus />
                New workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
