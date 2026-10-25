"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";

// For dialog forms: on a success message, toast it and close. Each result is handled once,
// however often the component re-renders.
export function useCloseOnSuccess(state: ActionState, close: () => void) {
  const handled = useRef<ActionState>(null);
  useEffect(() => {
    if (!state?.message || handled.current === state) return;
    handled.current = state;
    toast.success(state.message);
    close();
  }, [state, close]);
}
