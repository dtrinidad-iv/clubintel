import { BellRing, BrainCircuit, Database, LayoutDashboard, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Database, title: "National club database", body: "Every club across the leagues, with attendance, capacity and league history." },
  { icon: Target, title: "Commercial pipeline", body: "Track sponsorship, hospitality and media opportunities from lead to signed." },
  { icon: LayoutDashboard, title: "Intelligence dashboards", body: "Pipeline value, win rates and national trends at a glance, on any device." },
  { icon: BrainCircuit, title: "AI-written reports", body: "Weekly commercial briefings drafted by AI from your own data, approved by your team." },
  { icon: BellRing, title: "Automated alerts", body: "Stale deals, missed close dates and attendance drops flagged before they cost you." },
  { icon: ShieldCheck, title: "Secure multi-club workspaces", body: "Each organization's data is isolated at the database, with roles for every teammate." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center md:pt-24">
          <p className="mb-4 text-sm font-medium text-muted-foreground">Intelligence and club management for professional sport</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Know every club, every deal and every opportunity.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            ClubIntel brings national club data, your commercial pipeline and AI-written reports together, so your team
            spends less time gathering numbers and more time closing partnerships.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create a workspace</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="mb-4 size-6 text-primary" aria-hidden />
              <h2 className="font-medium">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        ClubIntel. A demo product: all clubs and data are fictional.
      </footer>
    </div>
  );
}
