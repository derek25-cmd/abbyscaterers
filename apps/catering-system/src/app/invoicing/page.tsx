
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Since this is a parent route for a group, redirect to the first logical child.
export default function InvoicingRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/invoicing/final');
    }, [router]);

    return null; // Or a loading spinner
}
