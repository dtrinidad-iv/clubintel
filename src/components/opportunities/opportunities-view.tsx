"use client";

import { Plus } from "lucide-react";
import { createContext, use, useMemo, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
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
import { Card } from "@/components/ui/card";
import { useDialogState } from "@/components/app/use-dialog-state";
import { formatGbp, stageLabel } from "@/lib/format";
import type { FormOptions, OpportunityRow } from "@/lib/opportunities";
import { deleteOpportunity, moveOpportunity } from "@/lib/opportunity-actions";
import { OPPORTUNITY_LIMIT, type OpportunityFilters } from "@/lib/validation";
import { OpportunityBoard } from "./opportunity-board";
import { OpportunityDialog } from "./opportunity-dialog";
import { OpportunityTable } from "./opportunity-table";

type Stage = OpportunityRow["stage"];
type Change = { type: "move"; id: string; stage: Stage } | { type: "delete"; id: string };

type Editor = {
  canWrite: boolean;
  canDelete: boolean;
  edit: (row: OpportunityRow) => void;
  move: (row: OpportunityRow, stage: Stage) => void;
  remove: (row: OpportunityRow) => void;
};

const EditorContext = createContext<Editor | null>(null);

export function useEditor() {
  const editor = use(EditorContext);
  if (!editor) throw new Error("useEditor outside OpportunitiesView");
  return editor;
}

// Rows are shown optimistically: a move or delete appears at once and settles when the
// server's refresh arrives (or reverts, with a toast, if it failed).
export function OpportunitiesView({
  rows,
  options,
  view,
  canWrite,
  canDelete,
  filtered,
  truncated,
}: {
  rows: OpportunityRow[];
  options: FormOptions;
  view: OpportunityFilters["view"];
  canWrite: boolean;
  canDelete: boolean;
  filtered: boolean;
  truncated: boolean;
}) {
  const [optimisticRows, apply] = useOptimistic(rows, (current: OpportunityRow[], change: Change) =>
    change.type === "delete"
      ? current.filter((r) => r.id !== change.id)
      : current.map((r) => (r.id === change.id ? { ...r, stage: change.stage } : r)),
  );
  const [, startTransition] = useTransition();
  const editDialog = useDialogState<OpportunityRow | "new">();
  const deleteDialog = useDialogState<OpportunityRow>();

  const editor = useMemo<Editor>(
    () => ({
      canWrite,
      canDelete,
      edit: editDialog.show,
      remove: deleteDialog.show,
      move(row, stage) {
        if (row.stage === stage) return;
        startTransition(async () => {
          apply({ type: "move", id: row.id, stage });
          const result = await moveOpportunity(row.id, stage);
          if (result?.error) toast.error(result.error);
          else toast.success(`Moved "${row.title}" to ${stageLabel(stage)}.`);
        });
      },
    }),
    [canWrite, canDelete, editDialog.show, deleteDialog.show, apply],
  );

  function confirmDelete(row: OpportunityRow) {
    startTransition(async () => {
      apply({ type: "delete", id: row.id });
      const result = await deleteOpportunity(row.id);
      if (result?.error) toast.error(result.error);
      else if (result?.message) toast.success(result.message);
    });
  }

  return (
    <EditorContext value={editor}>
      {filtered && <p className="mb-2 text-xs text-muted-foreground">Totals for the opportunities that match the filters.</p>}
      <PipelineSummary rows={optimisticRows} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {optimisticRows.length} {optimisticRows.length === 1 ? "opportunity" : "opportunities"}
          {filtered ? " match these filters" : ""}
          {truncated ? `. Showing the ${OPPORTUNITY_LIMIT} most recently moved; narrow the filters to see the rest.` : ""}
        </p>
        {canWrite && (
          <Button onClick={() => editDialog.show("new")}>
            <Plus aria-hidden /> New opportunity
          </Button>
        )}
      </div>

      {optimisticRows.length === 0 ? (
        <EmptyState filtered={filtered} canWrite={canWrite} onCreate={() => editDialog.show("new")} />
      ) : view === "board" ? (
        <OpportunityBoard rows={optimisticRows} />
      ) : (
        <OpportunityTable rows={optimisticRows} />
      )}

      <OpportunityDialog
        formKey={editDialog.key}
        open={editDialog.isOpen}
        onOpenChange={editDialog.onOpenChange}
        onCloseAutoFocus={editDialog.onCloseAutoFocus}
        opportunity={editDialog.item === "new" || editDialog.item === null ? undefined : editDialog.item}
        options={options}
      />

      <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent onCloseAutoFocus={deleteDialog.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteDialog.item?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This removes it for everyone in the workspace. It can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteDialog.item && confirmDelete(deleteDialog.item)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EditorContext>
  );
}

function PipelineSummary({ rows }: { rows: OpportunityRow[] }) {
  const open = rows.filter((r) => r.stage !== "won" && r.stage !== "lost");
  const won = rows.filter((r) => r.stage === "won");
  const closed = rows.filter((r) => r.stage === "won" || r.stage === "lost").length;
  const sum = (list: OpportunityRow[]) => list.reduce((total, r) => total + Number(r.value_gbp), 0);

  const rate = closed ? `${Math.round((won.length / closed) * 100)}%` : "–";
  // The three sit side by side with compact amounts until lg; at md the sidebar leaves them narrow.
  const figures = [
    { label: "Open pipeline", value: formatGbp(sum(open)), short: formatGbp(sum(open), { compact: true }), detail: `${open.length} open` },
    { label: "Won", value: formatGbp(sum(won)), short: formatGbp(sum(won), { compact: true }), detail: `${won.length} won` },
    { label: "Win rate", value: rate, short: rate, detail: `of ${closed} closed` },
  ];
  return (
    <dl className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
      {figures.map((f) => (
        <Card key={f.label} className="min-w-0 gap-1 py-3 sm:py-4">
          <dt className="truncate px-3 text-xs text-muted-foreground sm:px-4 sm:text-sm">{f.label}</dt>
          <dd className="px-3 text-lg font-semibold tabular-nums sm:px-4 sm:text-2xl">
            <span className="lg:hidden">{f.short}</span>
            <span className="hidden lg:inline">{f.value}</span>
          </dd>
          <dd className="truncate px-3 text-xs text-muted-foreground sm:px-4">{f.detail}</dd>
        </Card>
      ))}
    </dl>
  );
}

function EmptyState({ filtered, canWrite, onCreate }: { filtered: boolean; canWrite: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <h2 className="font-medium">{filtered ? "No opportunities match these filters" : "No opportunities yet"}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Try clearing a filter."
          : canWrite
            ? "Track every sponsorship, hospitality, media and partnership deal from first lead to signed."
            : "When your team adds deals, they'll show up here."}
      </p>
      {!filtered && canWrite && (
        <Button onClick={onCreate}>
          <Plus aria-hidden /> Add the first one
        </Button>
      )}
    </div>
  );
}
