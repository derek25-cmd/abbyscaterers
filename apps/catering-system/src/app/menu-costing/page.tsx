
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const MenuCostingDashboard = dynamic(() =>
    import('@/components/menu-costing/MenuCostingDashboard'),
    {
        ssr: false,
        loading: () => <LoadingPage title="Loading Menu Costing..." message="Preparing your dynamic costing engine." />
    }
);

export default function MenuCostingPage() {
    return <MenuCostingDashboard />;
}
