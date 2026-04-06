import { createClient } from "./lib/supabase/server";

async function diagnose() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Logged as:", user?.email, "ID:", user?.id);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
  console.log("Profile Role:", profile?.role);

  const { data: classes } = await supabase.from("classes").select("*");
  console.log("All Classes (as user):", JSON.stringify(classes, null, 2));

  const { data: memberships } = await supabase.from("class_members").select("*").eq("user_id", user?.id);
  console.log("My Memberships:", JSON.stringify(memberships, null, 2));
}

diagnose();
