"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useDeleteVisit } from "../../hooks/useMarketingQuery";

export function DeleteVisitDialog({
  open,
  onOpenChange,
  visit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: { id: string; companyName: string } | null;
}) {
  const { toast } = useToast();
  const deleteVisit = useDeleteVisit();

  const handleConfirm = async () => {
    if (!visit) return;
    try {
      await deleteVisit.mutateAsync(visit.id);
      toast({ title: "Visit deleted" });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not delete visit",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this visit?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the visit logged at {visit?.companyName ?? "this company"}, including its GPS
            check-in record. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteVisit.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteVisit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Visit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
