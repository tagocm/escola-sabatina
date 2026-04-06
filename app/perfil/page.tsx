import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Header from "@/components/ui/Header";
import ProfileForm from "@/components/ui/ProfileForm";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className={pageShellClass}>
      
      <Header />

      <main className={pageMainClass}>
        <PageHeader 
          title="Meu Perfil"
          subtitle="Gerencie suas informações pessoais e configurações da conta"
          backHref="/"
          backLabel="Voltar ao Painel"
        />

        <div className={`${surfaceClass} p-4 md:p-8 lg:p-10`}>
          <ProfileForm profile={{ ...profile, email: user.email! }} />
        </div>
      </main>
    </div>
  );
}
