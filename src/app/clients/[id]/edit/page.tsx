import { ClientEditPageComponent } from './client-edit-page-component';

export async function generateStaticParams() {
  return [];
}

export default function EditClientPage() {
  return <ClientEditPageComponent />;
}
