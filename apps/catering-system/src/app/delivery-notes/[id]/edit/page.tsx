
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import { EditDeliveryNoteForm } from "@/components/delivery-notes/edit-delivery-note-form";
import type { DeliveryNote } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LoadingPage } from "@/components/layout/loading-page";

export default function DeliveryNoteEditPage() {
  const params = useParams();
  const { getDeliveryNoteById, isLoading: notesLoading } = useDeliveryNoteStorage();
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const noteId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (notesLoading) return;
    if (!noteId) {
      setError("Invalid delivery note ID provided in the URL.");
      return;
    }
    const found = getDeliveryNoteById(noteId);
    if (found) {
      setDeliveryNote(found);
    } else {
      setError("Delivery note not found. It may have been deleted or the ID is incorrect.");
    }
  }, [noteId, getDeliveryNoteById, notesLoading]);

  if (notesLoading) {
    return <LoadingPage title="Loading Delivery Note..." message="Getting the form ready for your changes." />;
  }

  if (error || !deliveryNote) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive">
          {error || "Could not load delivery note for editing."}
        </h2>
        <Button asChild className="mt-4"><Link href="/delivery-notes">Back to List</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <EditDeliveryNoteForm deliveryNote={deliveryNote} />
    </div>
  );
}
