import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Link href="/" aria-label="ClubIntel home">
        <Logo className="text-lg" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
