
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
import { useSettingsStorage } from "@/hooks/use-settings-storage";

export default function DeliveryNoteViewPage() {
    const params = useParams();
    const { getDeliveryNoteById, isLoading: notesLoading } = useDeliveryNoteStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();
    const { settings } = useSettingsStorage();
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

        const pdfScale = settings.pdfScale || 2.0;
        const CARD_RENDER_WIDTH = 890;
        const TARGET_CANVAS_WIDTH = CARD_RENDER_WIDTH * pdfScale;

        const savedStyle = element.style.cssText;
        element.style.width = `${CARD_RENDER_WIDTH}px`;
        element.style.minWidth = `${CARD_RENDER_WIDTH}px`;
        element.style.maxWidth = `${CARD_RENDER_WIDTH}px`;
        element.style.boxSizing = 'border-box';
        await new Promise(res => setTimeout(res, 50));

        try {
            const scale = TARGET_CANVAS_WIDTH / Math.max(element.scrollWidth, 1);
            const canvas = await html2canvas(element, {
                scale,
                useCORS: true,
                logging: false,
                allowTaint: true
            });
            element.style.cssText = savedStyle;

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`delivery_note_${deliveryNote?.id}.pdf`);
            toast({ title: 'Success', description: 'Delivery note exported as PDF.' });
        } catch (error) {
            element.style.cssText = savedStyle;
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
                <div>
                    <h1 className="text-2xl font-bold text-primary">Delivery Note Preview</h1>
                    <p className="text-sm text-muted-foreground">Adjust "Content Scale Factor" in Settings to fit the page better.</p>
                </div>
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
