import type { ReactNode } from 'react';
import { HrModuleGate } from '@/components/hr/hr-module-gate';

// Hidden ("Not available yet") when the leave module is switched off (lib/hr-modules).
export default function Layout({ children }: { children: ReactNode }) {
  return <HrModuleGate module="leave">{children}</HrModuleGate>;
}
