"use client";

import { Mail, MoreHorizontal, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SelectField, TextareaField } from "@/components/auth/form-parts";
import { useCloseOnSuccess } from "@/components/app/use-close-on-success";
import { useDialogState } from "@/components/app/use-dialog-state";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteContact, saveContact } from "@/lib/contact-actions";
import type { ContactRow } from "@/lib/contacts";

type Clubs = { id: string; name: string }[];

export function ContactsView({
  contacts,
  clubs,
  canWrite,
  canDelete,
  searched,
}: {
  contacts: ContactRow[];
  clubs: Clubs;
  canWrite: boolean;
  canDelete: boolean;
  searched: boolean;
}) {
  const [rows, removeOptimistic] = useOptimistic(contacts, (current: ContactRow[], id: string) => current.filter((c) => c.id !== id));
  const [, startTransition] = useTransition();
  const editDialog = useDialogState<ContactRow | "new">();
  const deleteDialog = useDialogState<ContactRow>();

  function confirmDelete(contact: ContactRow) {
    startTransition(async () => {
      removeOptimistic(contact.id);
      const result = await deleteContact(contact.id);
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  }

  const menu = (contact: ContactRow) =>
    canWrite || canDelete ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${contact.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canWrite && <DropdownMenuItem onSelect={() => editDialog.show(contact)}>Edit</DropdownMenuItem>}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onSelect={() => deleteDialog.show(contact)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {rows.length} {rows.length === 1 ? "contact" : "contacts"}
          {searched ? " match" : ""}
        </p>
        {canWrite && (
          <Button onClick={() => editDialog.show("new")}>
            <Plus aria-hidden /> New contact
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <h2 className="font-medium">{searched ? "No contacts match" : "No contacts yet"}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {searched ? "Try a shorter name." : "The people behind your deals: club staff and partners' brand teams."}
          </p>
          {searched ? (
            <Button variant="outline" asChild>
              <Link href="/contacts">Clear search</Link>
            </Button>
          ) : (
            canWrite && (
              <Button onClick={() => editDialog.show("new")}>
                <Plus aria-hidden /> Add the first one
              </Button>
            )
          )}
        </div>
      ) : (
        <>
          <div className="hidden rounded-lg border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden xl:table-cell">Phone</TableHead>
                  <TableHead className="text-right">Opportunities</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} data-testid="contact-row">
                    <TableCell className="max-w-64">
                      <div className="truncate font-medium">{c.name}</div>
                      {c.role_title && <div className="truncate text-xs text-muted-foreground">{c.role_title}</div>}
                    </TableCell>
                    <TableCell>
                      {c.club ? (
                        <Link href={`/clubs/${c.club.id}`} className="underline-offset-4 hover:underline">
                          {c.club.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Partner side</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="underline-offset-4 hover:underline">
                          {c.email}
                        </a>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">{c.phone ?? "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.opportunityCount}</TableCell>
                    <TableCell>{menu(c)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Card className="py-4" data-testid="contact-card">
                  <CardContent className="grid gap-2 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {[c.role_title, c.club?.name].filter(Boolean).join(" · ") || "Partner side"}
                        </div>
                      </div>
                      {menu(c)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1 underline-offset-4 hover:underline">
                          <Mail className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{c.email}</span>
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                          <Phone className="size-3.5" aria-hidden /> {c.phone}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <ContactDialog
        formKey={editDialog.key}
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        onCloseAutoFocus={editDialog.onCloseAutoFocus}
        contact={editDialog.item === "new" || editDialog.item === null ? undefined : editDialog.item}
        clubs={clubs}
      />

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent onCloseAutoFocus={deleteDialog.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.item?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.item?.opportunityCount
                ? `${deleteDialog.item.opportunityCount} ${deleteDialog.item.opportunityCount === 1 ? "opportunity keeps" : "opportunities keep"} going without a contact. `
                : ""}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteDialog.item && confirmDelete(deleteDialog.item)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ContactDialog({
  formKey,
  open,
  onOpenChange,
  onCloseAutoFocus,
  contact,
  clubs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  formKey: number;
  contact?: ContactRow;
  clubs: Clubs;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>Someone at a club, or on the partner side, that your deals depend on.</DialogDescription>
        </DialogHeader>
        <ContactForm key={formKey} contact={contact} clubs={clubs} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({ contact, clubs, onDone }: { contact?: ContactRow; clubs: Clubs; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveContact.bind(null, contact?.id ?? null), null);
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} noValidate className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" defaultValue={contact?.name} state={state} required maxLength={120} />
        <Field name="roleTitle" label="Role" defaultValue={contact?.role_title} state={state} maxLength={120} placeholder="e.g. Head of Partnerships" />
        <Field name="email" label="Email" type="email" defaultValue={contact?.email} state={state} maxLength={254} />
        <Field name="phone" label="Phone" type="tel" defaultValue={contact?.phone} state={state} maxLength={40} />
      </div>
      <SelectField name="clubId" label="Club" state={state} emptyLabel="Partner side (no club)" options={clubs.map((c) => ({ value: c.id, label: c.name }))} defaultValue={contact?.club_id} />
      <TextareaField name="notes" label="Notes" defaultValue={contact?.notes} state={state} maxLength={2000} rows={3} />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : contact ? "Save changes" : "Add contact"}
        </Button>
      </DialogFooter>
    </form>
  );
}
