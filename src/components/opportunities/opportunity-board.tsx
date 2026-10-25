"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { formatGbp, stageLabel } from "@/lib/format";
import type { OpportunityRow } from "@/lib/opportunities";
import { OPPORTUNITY_STAGES } from "@/lib/validation";
import { useEditor } from "./opportunities-view";
import { OpportunityMenu } from "./opportunity-menu";
import { useOwnerName } from "./owner-names";

type Stage = OpportunityRow["stage"];

// Left and right arrows jump a whole stage (the default moves 25px, which never reaches the
// next column). Coordinates are the dragged card's top-left; land it just inside the column.
const stageByStage: KeyboardCoordinateGetter = (event, { context }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!step) return undefined;
  event.preventDefault();
  const current = (context.over?.id ?? context.active?.data.current?.stage) as Stage | undefined;
  const index = current ? OPPORTUNITY_STAGES.indexOf(current) : -1;
  const next = OPPORTUNITY_STAGES[Math.min(Math.max(index + step, 0), OPPORTUNITY_STAGES.length - 1)];
  // Read the column's live position: dnd-kit's stored rects can still be mid-measurement right
  // after pick-up (it scrolls the card into view), which made the first arrow press a no-op.
  const rect = next ? (context.droppableContainers.get(next)?.node.current?.getBoundingClientRect() ?? context.droppableRects.get(next)) : undefined;
  return rect ? { x: rect.left + 8, y: rect.top + 40 } : undefined;
};

// A kanban by stage. Dragging is one way to move a card; every card's menu is the other, so
// keyboard, touch and screen-reader users never depend on dragging.
export function OpportunityBoard({ rows }: { rows: OpportunityRow[] }) {
  const { canWrite, move } = useEditor();
  const [active, setActive] = useState<OpportunityRow | null>(null);
  // A stable id keeps dnd-kit's generated aria ids the same on server and client.
  const dndId = useId();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const title = (id: string | number) => byId.get(String(id))?.title ?? "the opportunity";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold on touch, so a swipe still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Instant scroll: when the target column is past the middle of the scrolling board, dnd-kit
    // scrolls the board instead of moving the card, and a smooth scroll made the move land late.
    useSensor(KeyboardSensor, { coordinateGetter: stageByStage, scrollBehavior: "auto" }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} is over ${stageLabel(over.id as Stage)}.` : `${title(active.id)} is not over a stage.`),
    onDragEnd: ({ active, over }) => (over ? `Moved ${title(active.id)} to ${stageLabel(over.id as Stage)}.` : `${title(active.id)} was dropped back.`),
    onDragCancel: ({ active }) => `Cancelled. ${title(active.id)} stays where it was.`,
  };

  function onDragStart(event: DragStartEvent) {
    setActive(byId.get(String(event.active.id)) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const row = byId.get(String(event.active.id));
    if (row && event.over) move(row, event.over.id as Stage);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move this opportunity, press space or enter, use the arrow keys to choose a stage, then press space or enter again. Press escape to cancel.",
        },
      }}
    >
      {/* Columns keep a readable width and the board scrolls sideways when they don't fit. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="grid w-max auto-cols-[15rem] grid-flow-col gap-3">
          {OPPORTUNITY_STAGES.map((stage) => (
            <StageColumn key={stage} stage={stage} rows={rows.filter((r) => r.stage === stage)} draggable={canWrite} />
          ))}
        </div>
      </div>
      <DragOverlay>{active ? <CardBody row={active} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function StageColumn({ stage, rows, draggable }: { stage: Stage; rows: OpportunityRow[]; draggable: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = rows.reduce((sum, r) => sum + Number(r.value_gbp), 0);

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`stage-${stage}`}
      data-testid={`stage-${stage}`}
      className={cn("flex min-h-48 min-w-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2 transition-colors", isOver && "border-primary bg-muted")}
    >
      <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
        <h2 id={`stage-${stage}`} className="text-sm font-medium">
          {stageLabel(stage)} <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">{formatGbp(total, { compact: true })}</span>
      </header>
      {/* grid-cols-1 is minmax(0, 1fr): long titles truncate instead of widening the column. */}
      <ul className="grid grid-cols-1 gap-2">
        {rows.map((row) => (
          <li key={row.id} className="min-w-0">
            <DraggableCard row={row} draggable={draggable} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DraggableCard({ row, draggable }: { row: OpportunityRow; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id, disabled: !draggable, data: { stage: row.stage } });
  return (
    <div ref={setNodeRef} className={cn("min-w-0", isDragging && "opacity-40")} data-testid="board-card">
      <CardBody row={row} handle={draggable ? { ...attributes, ...listeners } : undefined} />
    </div>
  );
}

function CardBody({ row, handle, lifted }: { row: OpportunityRow; handle?: React.HTMLAttributes<HTMLButtonElement>; lifted?: boolean }) {
  const ownerName = useOwnerName();
  return (
    <div className={cn("grid grid-cols-1 gap-1 rounded-md border bg-card p-2 text-sm shadow-xs", lifted && "rotate-1 shadow-lg")}>
      <div className="flex items-start gap-1">
        {handle ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none rounded text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
            aria-label={`Drag ${row.title}`}
            {...handle}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{row.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.partner_name} · {row.club?.name}
          </div>
        </div>
        {!lifted && <OpportunityMenu row={row} />}
      </div>
      <div className="flex items-center justify-between gap-2 pl-5 text-xs">
        <span className="font-medium tabular-nums">{formatGbp(Number(row.value_gbp))}</span>
        <span className="truncate text-muted-foreground">{ownerName(row.owner_id)}</span>
      </div>
    </div>
  );
}
