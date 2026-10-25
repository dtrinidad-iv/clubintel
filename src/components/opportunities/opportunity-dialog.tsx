"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField, TextareaField } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { useCloseOnSuccess } from "@/components/app/use-close-on-success";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { categoryLabel, stageLabel } from "@/lib/format";
import type { FormOptions, OpportunityRow } from "@/lib/opportunities";
import { saveOpportunity } from "@/lib/opportunity-actions";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_STAGES } from "@/lib/validation";

const stageOptions = OPPORTUNITY_STAGES.map((s) => ({ value: s, label: stageLabel(s) }));
const categoryOptions = OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }));

// Create (no opportunity) or edit. formKey changes on every open, so the form starts fresh.
export function OpportunityDialog({
  formKey,
  open,
  onOpenChange,
  onCloseAutoFocus,
  opportunity,
  options,
}: {
  formKey: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  opportunity?: OpportunityRow;
  options: FormOptions;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{opportunity ? "Edit opportunity" : "New opportunity"}</DialogTitle>
          <DialogDescription>A commercial deal with a club, from first lead to signed.</DialogDescription>
        </DialogHeader>
        <OpportunityForm key={formKey} opportunity={opportunity} options={options} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OpportunityForm({ opportunity, options, onDone }: { opportunity?: OpportunityRow; options: FormOptions; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveOpportunity.bind(null, opportunity?.id ?? null), null);

  useCloseOnSuccess(state, onDone);

  // noValidate: every error comes from the shared zod schema, inline, the same way for every field.
  return (
    <form action={action} noValidate className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label="Title" defaultValue={opportunity?.title} state={state} required maxLength={120} />
        <Field name="partnerName" label="Partner" defaultValue={opportunity?.partner_name} state={state} required maxLength={120} placeholder="The brand or company" />
        <SelectField name="clubId" label="Club" state={state} required options={options.clubs.map((c) => ({ value: c.id, label: c.name }))} defaultValue={opportunity?.club_id} />
        <SelectField name="category" label="Category" state={state} required options={categoryOptions} defaultValue={opportunity?.category ?? "sponsorship"} />
        <SelectField name="stage" label="Stage" state={state} required options={stageOptions} defaultValue={opportunity?.stage ?? "lead"} />
        <Field name="valueGbp" label="Value (£)" inputMode="decimal" defaultValue={opportunity?.value_gbp ?? ""} state={state} placeholder="0" />
        <SelectField name="ownerId" label="Owner" state={state} emptyLabel="Unassigned" options={options.members.map((m) => ({ value: m.id, label: m.name }))} defaultValue={opportunity?.owner_id} />
        <SelectField name="contactId" label="Contact" state={state} emptyLabel="No contact" options={options.contacts.map((c) => ({ value: c.id, label: c.name }))} defaultValue={opportunity?.contact_id} />
        <Field name="expectedCloseDate" label="Expected close" type="date" defaultValue={opportunity?.expected_close_date} state={state} />
      </div>
      <TextareaField name="notes" label="Notes" defaultValue={opportunity?.notes} state={state} maxLength={2000} rows={3} />
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : opportunity ? "Save changes" : "Add opportunity"}
        </Button>
      </DialogFooter>
    </form>
  );
}
