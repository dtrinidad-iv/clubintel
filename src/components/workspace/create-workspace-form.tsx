"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/lib/workspace-actions";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, null);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field name="name" label="Workspace name" placeholder="e.g. Northbridge Athletic Commercial" required maxLength={80} state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
