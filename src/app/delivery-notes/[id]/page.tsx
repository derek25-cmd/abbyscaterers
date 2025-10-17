
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { DeliveryNoteTemplate } from "@/components/delivery-notes/delivery-note-template";
import type { DeliveryNote, Client } from "@/types";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LoadingPage } from "@/components/layout/loading-page";

export default function DeliveryNoteViewPage() {
    const params = useParams();
    const { getDeliveryNoteById, isLoading: notesLoading } = useDeliveryNoteStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();
    const { toast } = useToast();

    const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | undefined>(undefined);
    const [client, setClient] = useState<Client | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const noteId = typeof params.id === 'string' ? params.id : undefined;

    useEffect(() => {
        if (notesLoading || clientsLoading) {
            return; // Wait until data is loaded
        }
        if (!noteId) {
            setError("Invalid delivery note ID provided in the URL.");
            return;
        }

        const foundNote = getDeliveryNoteById(noteId);
        
        if (foundNote) {
            setDeliveryNote(foundNote);
            // Use the correct snake_case field name
            if (foundNote.client_id) {
                const foundClient = getClientById(foundNote.client_id);
                setClient(foundClient);
                 if (!foundClient) {
                    setError(`Client with ID ${foundNote.client_id} not found for this delivery note.`);
                }
            } else {
                 setError("Client ID is missing from this delivery note.");
            }
        } else {
            setError("Delivery note not found. It may have been deleted or the ID is incorrect.");
        }
    }, [noteId, getDeliveryNoteById, getClientById, notesLoading, clientsLoading]);

    const handlePrint = () => window.print();

    const handleExportPDF = async () => {
        setIsExporting(true);
        const element = document.getElementById('delivery-note-pdf-content');
        if (!element) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find content to export.' });
            setIsExporting(false);
            return;
        }

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`delivery_note_${deliveryNote?.id}.pdf`);
            toast({ title: 'Success', description: 'Delivery note exported as PDF.' });
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export PDF.' });
        } finally {
            setIsExporting(false);
        }
    };
    
    if (notesLoading || clientsLoading) {
      return <LoadingPage title="Loading Delivery Note..." message="Fetching the details for your delivery record."/>;
    }
    
    if (error || !deliveryNote || !client) {
      return (
        <div className="text-center py-10 max-w-xl mx-auto">
          <h2 className="text-2xl font-semibold text-destructive">
            {error || 'Could not display delivery note.'}
          </h2>
          <Button asChild className="mt-4"><Link href="/delivery-notes">Back to List</Link></Button>
        </div>
      );
    }

    return (
        <>
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">Delivery Note Preview</h1>
                <div className="space-x-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />}
                        {isExporting ? "Exporting..." : "Export PDF"}
                    </Button>
                </div>
            </div>
            <DeliveryNoteTemplate deliveryNote={deliveryNote} client={client} />
        </>
    );
}
