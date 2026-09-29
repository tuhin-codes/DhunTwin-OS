import type { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({
  children,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F8F6] text-[#15211B]">
      {children}
    </div>
  );
}