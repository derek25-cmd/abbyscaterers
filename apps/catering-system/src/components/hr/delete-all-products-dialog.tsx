'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DELETE_ALL_PRODUCTS_PHRASE, deleteAllProducts, productsBackupCsv, type DeleteAllProductsResult,
} from '@/services/productService';

interface Props {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  productCount: number;
  onDeleted: (result: DeleteAllProductsResult) => void;
}

/**
 * Deletes the whole Product Catalog (Admin only). Two steps: download a backup
 * of every product, then type the confirmation phrase. The Stock Logs are not
 * touched.
 */
export function DeleteAllProductsDialog({ isOpen, setIsOpen, productCount, onDeleted }: Props) {
  const [backedUp, setBackedUp] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState<'backup' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setBackedUp(false); setPhrase(''); setError(null); setBusy(null); }
  }, [isOpen]);

  const downloadBackup = async () => {
    setBusy('backup'); setError(null);
    try {
      const { csv } = await productsBackupCsv();
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `product-catalog-backup-${new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' })}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackedUp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the backup.');
    } finally { setBusy(null); }
  };

  const confirmDelete = async () => {
    setBusy('delete'); setError(null);
    try {
      const result = await deleteAllProducts(phrase.trim());
      onDeleted(result);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the products.');
    } finally { setBusy(null); }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !busy && setIsOpen(o)}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all {productCount} products?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Every product in the catalog is removed, with its stock quantities and prices for all branches.
                <span className="font-medium text-foreground"> The Stock Logs stay exactly as they are</span>, and so do purchases and the
                price history; they keep the old product names and codes.
              </p>
              <p>
                Recipes that use catalog items, recipe costing and Abby&apos;s AI dish costs stop working until products are added again.
                Products added later get new codes. This cannot be undone from the app.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">1. Download a backup of the catalog</p>
            <p className="mb-2 text-xs text-muted-foreground">A CSV with every product and every column, to keep or re-import.</p>
            <Button variant="outline" size="sm" onClick={downloadBackup} disabled={!!busy}>
              {busy === 'backup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : backedUp ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> : <Download className="mr-2 h-4 w-4" />}
              {backedUp ? 'Backup downloaded' : 'Download backup (CSV)'}
            </Button>
          </div>
          <div className="space-y-1.5 rounded-md border p-3">
            <Label htmlFor="delete-all-phrase" className="text-sm font-medium">
              2. Type <span className="font-mono">{DELETE_ALL_PRODUCTS_PHRASE}</span> to confirm
            </Label>
            <Input id="delete-all-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} disabled={!backedUp || !!busy}
              autoComplete="off" placeholder={backedUp ? DELETE_ALL_PRODUCTS_PHRASE : 'Download the backup first'} />
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirmDelete}
            disabled={!!busy || !backedUp || phrase.trim() !== DELETE_ALL_PRODUCTS_PHRASE}>
            {busy === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete all products
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
