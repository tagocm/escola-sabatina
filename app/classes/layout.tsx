import { requireTeacherPage } from "@/lib/auth/guards";

export default async function ClassesLayout({ children }: { children: React.ReactNode }) {
  await requireTeacherPage();
  return children;
}
