
// No "use client" at the top of this file

import { ClientDetailsPageComponent } from './client-details-page-component';

export async function generateStaticParams() {
  // For `output: 'export'`, if dynamic paths depend on client-side data (localStorage),
  // we cannot know them at build time. Return an empty array.
  // Next.js will not pre-render any specific [id] pages based on this,
  // and they will be client-side rendered or handled if data is found.
  return [];
}

// This is now a Server Component
export default function ClientDetailPage() {
  // The ClientDetailsPageComponent will use useParams to get the id
  return <ClientDetailsPageComponent />;
}
