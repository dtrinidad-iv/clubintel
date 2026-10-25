import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Logo } from "@/components/logo";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { listMyWorkspaces } from "@/lib/dal";

export const metadata: Metadata = { title: "Create a workspace" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Logo className="text-lg" />
      <div className="w-full max-w-sm">
        <AuthCard
          title="Create a workspace"
          description="A workspace holds your club's commercial data. Invite your team once it's set up."
        >
          <CreateWorkspaceForm />
          <Suspense>
            <BackLink />
          </Suspense>
        </AuthCard>
      </div>
    </div>
  );
}

async function BackLink() {
  const workspaces = await listMyWorkspaces();
  if (workspaces.length === 0) return null;
  return (
    <Link href="/dashboard" className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
      Back to dashboard
    </Link>
  );
}
