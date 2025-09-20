import type { ReactNode } from "react";
import { AppLayout } from '@/components/hr/AppLayout';

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
