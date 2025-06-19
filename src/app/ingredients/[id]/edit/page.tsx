
import { IngredientEditPageComponent } from './ingredient-edit-page-component';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  // For 'output: export', dynamic routes are handled client-side.
  // Returning an empty array indicates no paths are pre-rendered at build time.
  // Client-side navigation will still work if data exists.
  return [];
}

export default function EditIngredientPage() {
  return <IngredientEditPageComponent />;
}
