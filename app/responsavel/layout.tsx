import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/app/actions/guardians";
import Header from "@/components/ui/Header";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await getUserRole();
  if (role !== "guardian") redirect("/");

  return (
    <div className={pageShellClass}>
      <div className="w-full">
        <Header title="Portal da Família" />
      </div>

      <main className={`${pageMainClass} mx-auto`}>
        {children}
      </main>
    </div>
  );
}
