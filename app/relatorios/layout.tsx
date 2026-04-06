import { requireTeacherPage } from "@/lib/auth/guards";

export default async function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  await requireTeacherPage();
  return children;
}
