
import type { ReactNode } from "react";
import { AppLayout } from '@/components/hr-ops/AppLayout';

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
