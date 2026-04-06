import { Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { getActiveClassContext } from "@/app/actions/classes";
import { createClient } from "@/lib/supabase/server";
import UserDropdown from "./UserDropdown";

interface ClassContext {
  id: string;
  name: string;
}

interface MembershipRow {
  classes: ClassContext | ClassContext[] | null;
}

export default async function Header({ title }: { title?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profiles and class memberships
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, last_class_id, role")
    .eq("id", user.id)
    .single();

  const canManageClasses = profile?.role !== "guardian";

  const { data: memberships } = await supabase
    .from("class_members")
    .select("classes (id, name)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const classes = ((memberships || []) as MembershipRow[]).map((membership) => {
    const cls = membership.classes;
    if (Array.isArray(cls)) return cls[0];
    return cls;
  }).filter((cls): cls is ClassContext => !!cls);
  
  // Resolve current context
  const currentClassId = await getActiveClassContext();
  const currentClass = classes.find(c => c.id === currentClassId);

  const displayTitle = title || currentClass?.name || "Escola Sabatina";

  return (
    <div className="relative z-40 mx-auto w-full max-w-6xl">
      <header className="overflow-visible border-4 border-foreground bg-card p-4 shadow-editorial md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 opacity-50">
              <Sparkles className="h-3.5 w-3.5 text-es-lilac stroke-[3]" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Escola Sabatina</span>
            </div>

            <div className="flex flex-col">
              <h1 className="break-words text-[clamp(1.85rem,8vw,2.75rem)] font-black uppercase leading-none tracking-tighter text-foreground">
                {displayTitle}
              </h1>
              <div className="mt-2 h-1.5 w-16 border-2 border-foreground bg-es-lilac shadow-editorial-sm" />
            </div>
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
            {!title && currentClassId && canManageClasses && (
              <Link
                href={`/classes/${currentClassId}`}
                className="group/settings flex h-11 w-11 shrink-0 items-center justify-center border-2 border-foreground bg-white shadow-editorial-sm transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5"
                title="Configurações da Unidade"
              >
                <Settings className="h-4 w-4 stroke-[2.5] transition-transform group-hover/settings:rotate-45" />
              </Link>
            )}

            <div className="min-w-0 flex-1 sm:w-auto sm:flex-none">
              <UserDropdown
                user={{ fullName: profile?.full_name || user.user_metadata?.full_name, email: user.email! }}
                classes={classes}
                currentClassId={currentClassId}
                canManageClasses={canManageClasses}
                compact={Boolean(title)}
              />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
