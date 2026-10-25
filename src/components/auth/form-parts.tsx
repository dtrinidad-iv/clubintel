"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

// Ids are unique per instance, not just the field name: Next keeps visited routes mounted (but
// hidden), so a sign-in form's #email can still be in the page when another form renders one,
// and a label points at the first element with its id.
function useFieldIds(name: string) {
  const id = `${name}-${useId()}`;
  return { id, errorId: `${id}-error` };
}

// After a failed submit the action returns what was sent in `values`. React resets the form, so
// the input remounts (keyed on the value) showing that; otherwise it shows `defaultValue`.
function shownValue(state: ActionState, name: string, defaultValue: unknown) {
  const value = state?.values?.[name] ?? (defaultValue == null ? undefined : String(defaultValue));
  return { defaultValue: value, key: value ?? "" };
}

export function Field({
  name,
  label,
  state,
  defaultValue,
  ...props
}: { name: string; label: string; state: ActionState; defaultValue?: string | number | null } & Omit<React.ComponentProps<typeof Input>, "defaultValue">) {
  const errors = state?.fieldErrors?.[name];
  const { id, errorId } = useFieldIds(name);
  const shown = shownValue(state, name, defaultValue);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} key={shown.key} defaultValue={shown.defaultValue} aria-invalid={errors ? true : undefined} aria-describedby={errors ? errorId : undefined} {...props} />
      <FieldError id={errorId} errors={errors} />
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
        {state.message}
      </p>
    );
  }
  return null;
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {errors[0]}
    </p>
  );
}

export function TextareaField({
  name,
  label,
  state,
  defaultValue,
  ...props
}: { name: string; label: string; state: ActionState; defaultValue?: string | number | null } & Omit<React.ComponentProps<typeof Textarea>, "defaultValue">) {
  const errors = state?.fieldErrors?.[name];
  const { id, errorId } = useFieldIds(name);
  const shown = shownValue(state, name, defaultValue);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} key={shown.key} defaultValue={shown.defaultValue} aria-invalid={errors ? true : undefined} aria-describedby={errors ? errorId : undefined} {...props} />
      <FieldError id={errorId} errors={errors} />
    </div>
  );
}

// A Radix select that submits through a hidden input, so optional fields can send "" for
// "none" (Radix items can't have an empty value).
export function SelectField({
  name,
  label,
  state,
  options,
  defaultValue,
  emptyLabel,
  required,
}: {
  name: string;
  label: string;
  state: ActionState;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  emptyLabel?: string;
  required?: boolean;
}) {
  const NONE = "__none";
  const [value, setValue] = useState(defaultValue || (emptyLabel ? NONE : ""));
  const errors = state?.fieldErrors?.[name];
  const { id, errorId } = useFieldIds(name);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {/* Always controlled: "" shows the placeholder. */}
      <Select value={value} onValueChange={setValue} required={required}>
        <SelectTrigger id={id} className="w-full" aria-invalid={errors ? true : undefined} aria-describedby={errors ? errorId : undefined}>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value === NONE ? "" : value} />
      <FieldError id={errorId} errors={errors} />
    </div>
  );
}
