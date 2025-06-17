
import { ClientEditPageComponent } from './client-edit-page-component';

export function generateStaticParams() {
  // For 'output: export', if params are determined client-side (e.g., from localStorage),
  // Next.js expects this function. Returning an empty array indicates
  // that no paths are pre-rendered at build time for this dynamic segment.
  // Client-side navigation will still work if data exists.
  return [];
}

export default function EditClientPage() {
  return <ClientEditPageComponent />;
}
