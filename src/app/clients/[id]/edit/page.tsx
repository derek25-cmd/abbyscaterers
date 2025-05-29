
// No "use client" at the top of this file

import { ClientEditPageComponent } from './client-edit-page-component';

export async function generateStaticParams() {
  // For `output: 'export'`, if dynamic paths depend on client-side data (localStorage),
  // we cannot know them at build time. Return an empty array.
  return [];
}

// This is now a Server Component
export default function EditClientPage() {
  return <ClientEditPageComponent />;
}
