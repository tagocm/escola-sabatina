export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
