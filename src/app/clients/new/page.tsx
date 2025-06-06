"use client"; // Make this page a Client Component

import { ClientForm } from '@/components/clients/client-form';

export default function NewClientPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <ClientForm />
    </div>
  );
}
