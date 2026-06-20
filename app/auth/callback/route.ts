import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

function safeNextPath(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = safeNextPath(next);
  redirectTo.search = "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/auth/nova-senha";
  redirectTo.searchParams.set("erro", "link-expirado");
  return NextResponse.redirect(redirectTo);
}
