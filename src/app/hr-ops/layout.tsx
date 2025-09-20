import type { ReactNode } from "react";
import { AppLayout } from '@/components/hr/app-layout';

export default function HrOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <AppLayout>
        {children}
      </AppLayout>
  );
}
