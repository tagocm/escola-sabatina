import { requireTeacherPage } from "@/lib/auth/guards";

export default async function AlunosLayout({ children }: { children: React.ReactNode }) {
  await requireTeacherPage();
  return children;
}
