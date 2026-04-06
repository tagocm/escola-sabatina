import { getAvailableClasses } from "@/app/actions/guardians";
import GuardianStudentForm from "@/components/ui/GuardianStudentForm";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { surfaceClass } from "@/components/ui/design-system";

export default async function NovoFilhoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const [classes, { data: profile }] = await Promise.all([
    getAvailableClasses(),
    supabase.from("profiles").select("whatsapp").eq("id", user?.id).single()
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cadastrar Filho"
        subtitle="Preencha os dados do seu filho para cadastrá-lo no sistema"
        backHref="/responsavel"
        backLabel="Voltar ao Painel"
      />
 
      <div className={`${surfaceClass} p-4 md:p-6`}>
        <GuardianStudentForm classes={classes} defaultWhatsapp={profile?.whatsapp} />
      </div>
    </div>
  );
}
