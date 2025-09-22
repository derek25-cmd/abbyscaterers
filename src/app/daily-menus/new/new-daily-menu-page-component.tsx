
"use client"; 

import { DailyMenuForm } from "@/components/daily-menus/daily-menu-form";
import { useSearchParams } from 'next/navigation';

export function NewDailyMenuPageComponent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  return (
    <div className="max-w-4xl mx-auto">
      <DailyMenuForm clientId={clientId ?? undefined} />
    </div>
  );
}
