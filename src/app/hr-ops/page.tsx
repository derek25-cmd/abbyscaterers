
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HrOpsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/hr-ops/dashboard');
  }, [router]);

  return null; 
}
