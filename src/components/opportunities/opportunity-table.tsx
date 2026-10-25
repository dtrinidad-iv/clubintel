"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryLabel, formatDate, formatGbp } from "@/lib/format";
import type { OpportunityRow } from "@/lib/opportunities";
import { OpportunityMenu } from "./opportunity-menu";
import { StageBadge } from "./stage-badge";
import { useOwnerName } from "./owner-names";

export function OpportunityTable({ rows }: { rows: OpportunityRow[] }) {
  const ownerName = useOwnerName();
  return (
    <>
      <div className="hidden rounded-lg border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opportunity</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden xl:table-cell">Owner</TableHead>
              <TableHead className="hidden xl:table-cell">Expected close</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-testid="opportunity-row">
                <TableCell className="max-w-72">
                  <div className="truncate font-medium">{row.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.partner_name} · {categoryLabel(row.category)}
                  </div>
                </TableCell>
                <TableCell>
                  {row.club ? (
                    <Link href={`/clubs/${row.club.id}`} className="underline-offset-4 hover:underline">
                      {row.club.name}
                    </Link>
                  ) : (
                    "–"
                  )}
                </TableCell>
                <TableCell>
                  <StageBadge stage={row.stage} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatGbp(Number(row.value_gbp))}</TableCell>
                <TableCell className="hidden xl:table-cell">{ownerName(row.owner_id)}</TableCell>
                <TableCell className="hidden xl:table-cell">{row.expected_close_date ? formatDate(row.expected_close_date) : "–"}</TableCell>
                <TableCell>
                  <OpportunityMenu row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="py-4" data-testid="opportunity-card">
              <CardContent className="grid gap-2 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.title}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {row.partner_name} · {row.club?.name}
                    </div>
                  </div>
                  <OpportunityMenu row={row} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <StageBadge stage={row.stage} />
                  <span className="font-medium tabular-nums">{formatGbp(Number(row.value_gbp))}</span>
                  <span className="text-muted-foreground">{ownerName(row.owner_id)}</span>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
