"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText, Files } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ExportOptions {
  showHeaders: boolean;
  preserveSpace: boolean;
}

interface ExportDocumentDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onExport: (options: { 
    proformaOptions: ExportOptions; 
    invoiceOptions: ExportOptions; 
    exportType: 'single' | 'bundle' 
  }) => Promise<void>;
  isExporting: boolean;
  hasAssociatedInvoice: boolean;
  docType: 'proforma' | 'invoice';
}

export function ExportDocumentDialog({
  isOpen,
  setIsOpen,
  onExport,
  isExporting,
  hasAssociatedInvoice,
  docType
}: ExportDocumentDialogProps) {
  const [showHeaders, setShowHeaders] = useState(true);
  const [preserveSpace, setPreserveSpace] = useState(false);
  
  const [invoiceShowHeaders, setInvoiceShowHeaders] = useState(true);
  const [invoicePreserveSpace, setInvoicePreserveSpace] = useState(false);
  
  const [exportType, setExportType] = useState<'single' | 'bundle'>('single');

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setShowHeaders(true);
      setPreserveSpace(false);
      setInvoiceShowHeaders(true);
      setInvoicePreserveSpace(false);
      setExportType('single');
    }
  }, [isOpen]);

  const handleExport = () => {
    onExport({ 
      proformaOptions: { showHeaders, preserveSpace }, 
      invoiceOptions: { showHeaders: invoiceShowHeaders, preserveSpace: invoicePreserveSpace },
      exportType 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
          <DialogDescription>
            Choose how you want to export your document.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {exportType === 'bundle' ? "Proforma Layout" : "Document Layout"}
            </h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="export-show-headers" className="flex flex-col space-y-1">
                <span>Header & Footer</span>
                <span className="font-normal text-xs text-muted-foreground">Include the standard company header and footer images</span>
              </Label>
              <Switch id="export-show-headers" checked={showHeaders} onCheckedChange={setShowHeaders} />
            </div>

            {!showHeaders && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-primary/20">
                <Label htmlFor="export-preserve-space" className="flex flex-col space-y-1">
                  <span>Preserve Space</span>
                  <span className="font-normal text-xs text-muted-foreground">Leave blank space for printing on official letterhead</span>
                </Label>
                <Switch id="export-preserve-space" checked={preserveSpace} onCheckedChange={setPreserveSpace} />
              </div>
            )}
          </div>

          {hasAssociatedInvoice && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Content to Export</h4>
              <RadioGroup value={exportType} onValueChange={(v:any) => setExportType(v)}>
                <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExportType('single')}>
                  <RadioGroupItem value="single" id="r1" />
                  <Label htmlFor="r1" className="flex flex-1 items-center justify-between cursor-pointer">
                    <span className="flex items-center"><FileText className="w-4 h-4 mr-2 text-primary" /> {docType === 'invoice' ? 'Invoice Only' : 'Proforma Only'}</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 space-y-0 p-3 border rounded-md cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExportType('bundle')}>
                  <RadioGroupItem value="bundle" id="r2" />
                  <Label htmlFor="r2" className="flex flex-1 gap-2 items-center justify-between cursor-pointer">
                    <span className="flex items-center text-primary font-medium"><Files className="w-4 h-4 mr-2" /> {docType === 'invoice' ? 'Bundle (Invoice + Proforma)' : 'Bundle (Proforma + Final Invoice)'}</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full uppercase font-bold text-nowrap">Combined PDF</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {exportType === 'bundle' && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-amber-600">{docType === 'invoice' ? 'Proforma Invoice Layout' : 'Final Invoice Layout'}</h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="invoice-show-headers" className="flex flex-col space-y-1">
                  <span>Header & Footer</span>
                  <span className="font-normal text-xs text-muted-foreground">Include company images for invoice</span>
                </Label>
                <Switch id="invoice-show-headers" checked={invoiceShowHeaders} onCheckedChange={setInvoiceShowHeaders} />
              </div>

              {!invoiceShowHeaders && (
                <div className="flex items-center justify-between pl-4 border-l-2 border-amber-500/20">
                  <Label htmlFor="invoice-preserve-space" className="flex flex-col space-y-1">
                    <span>Preserve Space</span>
                    <span className="font-normal text-xs text-muted-foreground">Space for letterhead (Invoice)</span>
                  </Label>
                  <Switch id="invoice-preserve-space" checked={invoicePreserveSpace} onCheckedChange={setInvoicePreserveSpace} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? "Exporting..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
