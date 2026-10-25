import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Welcome back to ClubIntel.">
      {/* The form reads ?next= and ?error=, which are only known at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
