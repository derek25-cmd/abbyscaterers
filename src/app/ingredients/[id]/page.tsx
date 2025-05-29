import { IngredientDetailsPageComponent } from './ingredient-details-page-component';

export async function generateStaticParams() {
  return [];
}

export default function IngredientDetailPage() {
  return <IngredientDetailsPageComponent />;
}
