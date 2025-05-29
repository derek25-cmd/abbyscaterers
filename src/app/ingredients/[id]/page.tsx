
// No "use client" at the top of this file

import { IngredientDetailsPageComponent } from './ingredient-details-page-component';

export async function generateStaticParams() {
  return [];
}

// This is now a Server Component
export default function IngredientDetailPage() {
  return <IngredientDetailsPageComponent />;
}
