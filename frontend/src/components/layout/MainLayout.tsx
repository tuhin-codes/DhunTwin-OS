import type { ReactNode } from "react";

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper text-ink">
      {children}
    </div>
  );
}
