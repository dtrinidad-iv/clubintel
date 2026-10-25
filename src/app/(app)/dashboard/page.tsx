import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import {
  KpiFallback,
  KpiTiles,
  NationalSection,
  SectionFallback,
  StageSection,
  TierSection,
  UpcomingSection,
  WonSection,
} from "@/components/dashboard/dashboard-sections";

export const metadata: Metadata = { title: "Dashboard" };

// The header is static; each section streams in its own <Suspense>.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your workspace's commercial pipeline, with national context from the club database." />
      <div className="grid gap-4">
        <Suspense fallback={<KpiFallback />}>
          <KpiTiles />
        </Suspense>
        <div className="grid gap-4 lg:grid-cols-2">
          <Suspense fallback={<SectionFallback label="pipeline by stage" />}>
            <StageSection />
          </Suspense>
          <Suspense fallback={<SectionFallback label="wins by month" />}>
            <WonSection />
          </Suspense>
          <Suspense fallback={<SectionFallback label="upcoming close dates" />}>
            <UpcomingSection />
          </Suspense>
          <Suspense fallback={<SectionFallback label="pipeline by tier" />}>
            <TierSection />
          </Suspense>
          <div className="lg:col-span-2">
            <Suspense fallback={<SectionFallback label="national attendance" />}>
              <NationalSection />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
