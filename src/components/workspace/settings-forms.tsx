"use client";

import { MoreHorizontal } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/auth/form-parts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionState } from "@/lib/action-state";
import type { Role } from "@/lib/dal";
import { roleLabel } from "@/lib/format";
import { setAiBudget } from "@/lib/report-actions";
import { addMember, changeMemberRole, removeMember, renameWorkspace } from "@/lib/workspace-actions";

type AssignableRole = Exclude<Role, "owner">;

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  isYou: boolean;
  manageable: boolean;
};

export function RenameWorkspaceForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(renameWorkspace, null);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <FormMessage state={state} />
      <Field name="name" label="Name" defaultValue={state?.values?.name ?? name} state={state} disabled={!canEdit} required maxLength={80} />
      {canEdit && (
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}

export function AddMemberForm({ roles }: { roles: readonly AssignableRole[] }) {
  const [state, action, pending] = useActionState(addMember, null);
  const roleId = useId();
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field name="email" label="Add someone by email" type="email" placeholder="name@club.example" required state={state} />
        <div className="grid gap-2">
          <Label htmlFor={roleId}>Role</Label>
          <Select name="role" defaultValue={roles.at(-1)}>
            <SelectTrigger id={roleId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add member"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">They need a ClubIntel account already.</p>
    </form>
  );
}

export function MembersTable({ members, assignable }: { members: MemberRow[]; assignable: readonly AssignableRole[] }) {
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  function run(task: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await task();
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId} data-testid={`member-${m.email}`}>
                <TableCell>
                  <div className="font-medium">
                    {m.name} {m.isYou && <span className="text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "owner" ? "default" : "secondary"}>{roleLabel(m.role)}</Badge>
                </TableCell>
                <TableCell>
                  {m.manageable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Manage ${m.name}`} disabled={pending}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Change role</DropdownMenuLabel>
                        {assignable
                          .filter((r) => r !== m.role)
                          .map((r) => (
                            <DropdownMenuItem key={r} onSelect={() => run(() => changeMemberRole(m.userId, r))}>
                              Make {roleLabel(r).toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(m)}>
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to this workspace straight away.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removing && run(() => removeMember(removing.userId))}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AiBudgetForm({ budget }: { budget: number }) {
  const [state, action, pending] = useActionState(setAiBudget, null);
  return (
    <form action={action} className="grid max-w-md gap-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field name="budget" label="Monthly budget (US$)" inputMode="decimal" defaultValue={budget.toFixed(2)} state={state} required />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Save budget"}
        </Button>
      </div>
    </form>
  );
}
