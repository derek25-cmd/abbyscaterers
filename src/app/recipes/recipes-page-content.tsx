
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const RecipeListTable = dynamic(() =>
  import('@/components/recipes/recipe-list-table').then(mod => mod.RecipeListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Recipes..." message="Gathering all your recipe cards." />
  }
);

export function RecipesPageContent() {
  return <RecipeListTable />;
}
