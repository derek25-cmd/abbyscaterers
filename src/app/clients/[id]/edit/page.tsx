import { ClientEditPageComponent } from './client-edit-page-component';

export async function generateStaticParams() {
  // For 'output: export', if params are determined client-side (e.g., from localStorage),
  // return an empty array. Next.js will not pre-render these paths at build time.
  // Client-side navigation will still work.
  return [];
}

export default function EditClientPage() {
  return <ClientEditPageComponent />;
}
