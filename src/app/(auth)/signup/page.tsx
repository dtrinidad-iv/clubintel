import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthCard title="Create an account" description="Start tracking commercial intelligence for your club.">
      <SignUpForm />
    </AuthCard>
  );
}
