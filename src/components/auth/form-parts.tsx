import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";

export function Field({
  name,
  label,
  state,
  ...props
}: { name: string; label: string; state: ActionState } & React.ComponentProps<typeof Input>) {
  const errors = state?.fieldErrors?.[name];
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={state?.values?.[name]} key={state?.values?.[name]} aria-invalid={errors ? true : undefined} aria-describedby={errors ? `${name}-error` : undefined} {...props} />
      {errors && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
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
