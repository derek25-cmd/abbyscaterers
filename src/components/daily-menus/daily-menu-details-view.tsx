
"use client";

import React, { useState } from "react";
import type { DailyMenu, ClientEvent } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";
import { BookOpen, Info, CalendarClock, Utensils, SquarePen, Users, FileText, Loader2, UtensilsCrossed, CalendarDays, User } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Skeleton } from "../ui/skeleton";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "../ui/badge";

interface DailyMenuDetailsViewProps {
  menu: DailyMenu;
}

function ClientEventCard({ event }: { event: ClientEvent }) {
    const { getClientById, isLoading: clientsLoading } = useClientStorage();
    const { getRecipeById, isLoading: recipesLoading } = useRecipeStorage();

    const client = getClientById(event.clientId);

    const formatDateSafe = (dateString?: string, formatString: string = "MMMM d, yyyy") => {
        if (!dateString) return "N/A";
        const parsedDate = parseISO(dateString);
        return isValid(parsedDate) ? format(parsedDate, formatString) : "N/A";
    };

    return (
        <Card className="bg-card/50 shadow-md">
            <CardHeader className="border-b">
                {clientsLoading ? <Skeleton className="h-6 w-3/4" /> :
                <CardTitle className="text-xl text-primary flex items-center">{client?.companyName || "Unknown Client"}</CardTitle>
                }
                <CardDescription className="flex items-center gap-4 pt-1">
                    <span className="flex items-center gap-1.5 text-sm"><CalendarDays className="h-4 w-4 text-accent" /> {formatDateSafe(event.date)}</span>
                    <span className="flex items-center gap-1.5 text-sm"><Users className="h-4 w-4 text-accent" /> {event.numberOfPeople} People</span>
                    <Badge variant="secondary">{event.mealType}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                 <h4 className="font-semibold text-foreground mb-2 flex items-center"><UtensilsCrossed className="mr-2 h-4 w-4 text-primary"/>Recipes</h4>
                 {recipesLoading ? <Skeleton className="h-20 w-full" /> : (
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                        {event.recipes.map((r, index) => {
                            const recipe = getRecipeById(r.recipeId);
                            return <li key={index}>{recipe?.recipeName || "Unknown Recipe"}</li>
                        })}
                    </ul>
                 )}
            </CardContent>
        </Card>
    )
}

export function DailyMenuDetailsView({ menu }: DailyMenuDetailsViewProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: null
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${menu.name.replace(/ /g, '_')}_menu.pdf`);
      toast({ title: "Export Successful", description: "Menu exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
             <BookOpen className="mr-3 h-8 w-8 text-primary" />
             {menu.name}
           </h1>
           <p className="text-muted-foreground ml-11">
             Menu ID: {menu.id}
           </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handlePdfExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
               {isExporting ? 'Exporting...' : 'Export as PDF'}
            </Button>
            <Link href={`/daily-menus/${menu.id}/edit`} passHref>
              <Button>
                <SquarePen className="mr-2 h-4 w-4" /> Edit Menu
              </Button>
            </Link>
        </div>
      </div>
      
      <div ref={printRef} className="space-y-6">
        {menu.clientEvents && menu.clientEvents.length > 0 ? (
            menu.clientEvents.map((event, index) => (
                <ClientEventCard key={index} event={event} />
            ))
        ) : (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No client events have been added to this menu yet.</p>
                </CardContent>
            </Card>
        )}
      </div>

      <div className="mt-6 flex justify-end">
         <Link href="/daily-menus" passHref>
            <Button variant="ghost">Back to Menu List</Button>
          </Link>
      </div>
    </>
  );
}
