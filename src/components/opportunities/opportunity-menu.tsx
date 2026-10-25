"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stageLabel } from "@/lib/format";
import type { OpportunityRow } from "@/lib/opportunities";
import { OPPORTUNITY_STAGES } from "@/lib/validation";
import { useEditor } from "./opportunities-view";

// Edit, move and delete for one opportunity: the keyboard and touch path for everything the
// board does by dragging. Shows only what the user's permissions allow.
export function OpportunityMenu({ row }: { row: OpportunityRow }) {
  const { canWrite, canDelete, edit, move, remove } = useEditor();
  if (!canWrite && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${row.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canWrite && (
          <>
            <DropdownMenuItem onSelect={() => edit(row)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={row.stage} onValueChange={(stage) => move(row, stage as OpportunityRow["stage"])}>
              {OPPORTUNITY_STAGES.map((stage) => (
                <DropdownMenuRadioItem key={stage} value={stage}>
                  {stageLabel(stage)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {canDelete && (
          <>
            {canWrite && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" onSelect={() => remove(row)}>
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
