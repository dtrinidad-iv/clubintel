"use client";

import { useMemo, useRef, useState } from "react";

// State for a dialog opened from a button or a menu item, with no DialogTrigger:
// - the item stays set after closing, so the content doesn't go blank during the exit animation;
// - `key` changes on every open, so a form inside starts fresh each time;
// - focus goes back to what opened it (for a menu item, the menu's trigger button), which
//   Radix can't do without a trigger.
export function useDialogState<T>() {
  const [state, setState] = useState<{ isOpen: boolean; item: T | null; key: number }>({ isOpen: false, item: null, key: 0 });
  const returnTo = useRef<HTMLElement | null>(null);

  // Stable across renders, so context values built from them can be memoised.
  const actions = useMemo(
    () => ({
      show(item: T) {
        returnTo.current = focusOrigin();
        setState((s) => ({ isOpen: true, item, key: s.key + 1 }));
      },
      close() {
        setState((s) => ({ ...s, isOpen: false }));
      },
      onOpenChange(open: boolean) {
        if (!open) setState((s) => ({ ...s, isOpen: false }));
      },
      onCloseAutoFocus(event: Event) {
        const target = returnTo.current;
        if (target?.isConnected) {
          event.preventDefault();
          target.focus();
        }
      },
    }),
    [],
  );

  return { ...state, ...actions };
}

function focusOrigin(): HTMLElement | null {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const menuTriggerId = active?.closest("[role=menu]")?.getAttribute("aria-labelledby");
  return (menuTriggerId && document.getElementById(menuTriggerId)) || active;
}
