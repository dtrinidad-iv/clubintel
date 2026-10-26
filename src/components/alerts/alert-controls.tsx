"use client";

import { CheckCheck, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SelectField } from "@/components/auth/form-parts";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createRule, deleteRule, markAlertRead, markAllAlertsRead, runChecks, setRuleEnabled } from "@/lib/alert-actions";
import type { ActionState } from "@/lib/action-state";
import { alertRuleTypeLabel } from "@/lib/format";
import { ALERT_RULE_TYPES } from "@/lib/validation";

// Small client controls for the alerts pages. Each calls a Server Action, shows its result as
// a toast, and relies on refresh() to update the page and the sidebar badge.

function useAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionState>) =>
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  return { pending, run };
}

export function MarkReadButton({ alertId, title }: { alertId: string; title: string }) {
  const { pending, run } = useAction();
  // The button disappears once the alert is read, so focus moves to the inbox's status line.
  const markRead = () =>
    run(async () => {
      const result = await markAlertRead(alertId);
      document.querySelector<HTMLElement>("[data-alerts-status]")?.focus();
      return result;
    });
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={markRead} aria-label={`Mark "${title}" read`}>
      Mark read
    </Button>
  );
}

export function MarkAllReadButton() {
  const { pending, run } = useAction();
  return (
    <Button variant="outline" disabled={pending} onClick={() => run(markAllAlertsRead)}>
      <CheckCheck aria-hidden /> Mark all read
    </Button>
  );
}

export function RunChecksButton() {
  const { pending, run } = useAction();
  return (
    <Button disabled={pending} onClick={() => run(runChecks)}>
      <RefreshCw className={pending ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
      {pending ? "Checking…" : "Run checks now"}
    </Button>
  );
}

// name: short, for screen readers ("A deal goes quiet, 30 days"); description: the full sentence.
export function RuleControls({ ruleId, name, description, enabled }: { ruleId: string; name: string; description: string; enabled: boolean }) {
  const { pending, run } = useAction();
  const confirm = useDialogState<true>();
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-20"
        disabled={pending}
        onClick={() => run(() => setRuleEnabled(ruleId, !enabled))}
        aria-label={`${enabled ? "Turn off" : "Turn on"}: ${name}`}
      >
        {enabled ? "Turn off" : "Turn on"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => confirm.show(true)} aria-label={`Delete: ${name}`}>
        <Trash2 aria-hidden />
      </Button>
      <AlertDialog open={confirm.isOpen} onOpenChange={confirm.onOpenChange}>
        <AlertDialogContent onCloseAutoFocus={confirm.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>{description} Alerts it already raised stay in the inbox.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run(() => deleteRule(ruleId))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function NewRuleButton({ clubs }: { clubs: { id: string; name: string }[] }) {
  const dialog = useDialogState<true>();
  return (
    <>
      <Button onClick={() => dialog.show(true)}>
        <Plus aria-hidden /> New rule
      </Button>
      <Dialog open={dialog.isOpen} onOpenChange={dialog.onOpenChange}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={dialog.onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>New alert rule</DialogTitle>
            <DialogDescription>Checked every morning, and whenever someone runs checks now. Each match alerts once.</DialogDescription>
          </DialogHeader>
          <RuleForm key={dialog.key} clubs={clubs} onDone={() => dialog.close()} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RuleForm({ clubs, onDone }: { clubs: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(createRule, null);
  const [type, setType] = useState(state?.values?.type || "stale_opportunity");
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} noValidate className="grid gap-4">
      <FormMessage state={state} />
      <SelectField
        name="type"
        label="Alert when"
        state={state}
        required
        options={ALERT_RULE_TYPES.map((t) => ({ value: t, label: alertRuleTypeLabel(t) }))}
        defaultValue={type}
        onValueChange={setType}
      />
      {type === "stale_opportunity" && (
        <Field name="days" label="Days without a stage change" type="number" inputMode="numeric" min={1} max={365} defaultValue={30} state={state} required />
      )}
      {type === "close_date_passed" && (
        <Field name="days" label="Days of grace after the close date" type="number" inputMode="numeric" min={0} max={90} defaultValue={0} state={state} required />
      )}
      {type === "attendance_drop" && (
        <>
          <SelectField name="clubId" label="Club" state={state} required options={clubs.map((c) => ({ value: c.id, label: c.name }))} />
          <Field name="dropPct" label="Drop in average attendance (%)" type="number" inputMode="numeric" min={1} max={90} defaultValue={10} state={state} required />
        </>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add rule"}
        </Button>
      </DialogFooter>
    </form>
  );
}
