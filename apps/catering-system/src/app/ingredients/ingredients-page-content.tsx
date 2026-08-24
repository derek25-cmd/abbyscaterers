
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const IngredientListTable = dynamic(() =>
  import('@/components/ingredients/ingredient-list-table').then(mod => mod.IngredientListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Ingredients..." message="Getting your ingredient price list ready." />
  }
);

export function IngredientsPageContent() {
  return <IngredientListTable />;
}
