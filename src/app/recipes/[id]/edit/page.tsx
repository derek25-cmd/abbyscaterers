
import { RecipeEditPageComponent } from './recipe-edit-page-component';

export async function generateStaticParams() {
  return [];
}

export default function EditRecipePage() {
  return <RecipeEditPageComponent />;
}
