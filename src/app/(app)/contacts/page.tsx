import { Search } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ContactsView } from "@/components/contacts/contacts-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/dal";
import { clubOptions } from "@/lib/clubs";
import { listContacts } from "@/lib/contacts";
import { contactSearchSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  return (
    <>
      <PageHeader title="Contacts" description="The people behind your deals, at clubs and on the partner side." />
      <Suspense fallback={<Fallback />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contacts({ searchParams }: { searchParams: PageProps<"/contacts">["searchParams"] }) {
  const { workspace } = await requirePermission("contacts.view");
  const { q } = contactSearchSchema.parse(await searchParams);
  const [contacts, clubs] = await Promise.all([listContacts(workspace.id, q), clubOptions()]);
  const can = (p: string) => workspace.permissions.includes(p);

  return (
    <>
      <Form action="/contacts" role="search" aria-label="Search contacts" className="mb-6 grid max-w-md gap-2">
        <Label htmlFor="contact-q">Name</Label>
        <div className="flex gap-2">
          <Input id="contact-q" name="q" type="search" defaultValue={q ?? ""} key={q ?? ""} placeholder="Search contacts" maxLength={80} />
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
        </div>
      </Form>
      <ContactsView contacts={contacts} clubs={clubs} canWrite={can("contacts.write")} canDelete={can("contacts.delete")} searched={Boolean(q)} />
    </>
  );
}

function Fallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading contacts">
      <Skeleton className="h-16 max-w-md" />
      <Skeleton className="h-80" />
    </div>
  );
}
