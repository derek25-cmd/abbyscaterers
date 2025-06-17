
import { RecipeDetailsPageComponent } from './recipe-details-page-component';

export async function generateStaticParams() {
  return [];
}

export default function RecipeDetailPage() {
  return <RecipeDetailsPageComponent />;
}
