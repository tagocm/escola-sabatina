import { createClient } from "./lib/supabase/server";

async function checkClasses() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").select("*");
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Classes found:", JSON.stringify(data, null, 2));
}

checkClasses();
