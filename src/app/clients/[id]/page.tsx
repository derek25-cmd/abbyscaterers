
import { ClientDetailsPageComponent } from './client-details-page-component';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  // For 'output: export', dynamic routes are handled client-side.
  // Returning an empty array indicates no paths are pre-rendered at build time.
  // Client-side navigation will still work if data exists.
  return [];
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  return <ClientDetailsPageComponent />;
}
