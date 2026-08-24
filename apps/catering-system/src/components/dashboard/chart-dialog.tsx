
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChartContainer, ChartConfig } from "@/components/ui/chart";

interface ChartDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  description: string;
  chartConfig: ChartConfig;
  children: React.ReactElement;
}

export function ChartDialog({
  isOpen,
  setIsOpen,
  title,
  description,
  chartConfig,
  children,
}: ChartDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[70vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="w-full h-[calc(100%-4rem)] pt-4">
          <ChartContainer config={chartConfig} className="w-full h-full">
            {children}
          </ChartContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
