
// No "use client" at the top of this file

import { IngredientEditPageComponent } from './ingredient-edit-page-component';

export async function generateStaticParams() {
  return [];
}

// This is now a Server Component
export default function EditIngredientPage() {
  return <IngredientEditPageComponent />;
}
