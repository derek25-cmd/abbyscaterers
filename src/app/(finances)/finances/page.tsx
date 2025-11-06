
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to the first logical child page.
export default function FinancesRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/finances/purchases');
    }, [router]);

    return null;
}
