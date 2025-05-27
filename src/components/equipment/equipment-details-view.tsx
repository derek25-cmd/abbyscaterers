
"use client";

import type { Equipment } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit, Package, Tag, Zap, Hash, CalendarClock, Archive, Layers, ShieldCheck, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface EquipmentDetailsViewProps {
  equipment: Equipment;
}

export function EquipmentDetailsView({ equipment }: EquipmentDetailsViewProps) {
  
  const DetailItem = ({ icon: Icon, label, value, className = "" }: { icon: React.ElementType, label: string, value?: string | number | React.ReactNode, className?: string }) => {
    const hasValue = value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== "");

    return (
    <div className={cn("flex items-start space-x-3 py-3", className)}> 
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
      <div className="flex-grow"> 
        <p className="text-sm font-medium text-foreground">{label}</p>
        {!hasValue ? (
          <p className="text-sm text-muted-foreground">N/A</p> 
        ) : (
          <div className="text-sm text-muted-foreground break-words"> 
            {value}
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary flex items-center">
              <Package className="mr-2 h-7 w-7" /> {equipment.equipmentName}
            </CardTitle>
            <CardDescription className="text-md text-accent">
              Equipment No: {equipment.equipmentNumber}
            </CardDescription>
          </div>
          <Link href={`/equipment/${equipment.equipmentNumber}/edit`} passHref>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Equipment
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        
        <div className="space-y-1 divide-y divide-border">
          <h3 className="text-lg font-semibold text-foreground pt-2 pb-3 flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Basic Information</h3>
          <DetailItem icon={Tag} label="Equipment Name" value={equipment.equipmentName} />
          <DetailItem icon={Tag} label="Equipment No." value={equipment.equipmentNumber} />
          <DetailItem icon={Tag} label="OEM" value={equipment.oem} />
          <DetailItem icon={Tag} label="Model" value={equipment.model} />
        </div>
        
        <div className="space-y-1 divide-y divide-border">
          <h3 className="text-lg font-semibold text-foreground pt-2 pb-3 flex items-center"><Zap className="mr-2 h-5 w-5 text-primary" />Specifications</h3>
          <DetailItem icon={Zap} label="Power Rating" value={equipment.powerRating} />
          <DetailItem icon={Hash} label="Quantity" value={equipment.quantity} />
          <DetailItem icon={Layers} label="Capacity" value={equipment.capacity} />
           <DetailItem icon={ShieldCheck} label="Registration Number" value={equipment.registrationNumber} />
        </div>

        <div className="space-y-1 divide-y divide-border md:col-span-2">
            <h3 className="text-lg font-semibold text-foreground pt-4 pb-3 flex items-center"><Archive className="mr-2 h-5 w-5 text-primary" />Provenance & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="divide-y divide-border">
                    <DetailItem icon={CalendarClock} label="Year of Manufacture" value={equipment.yearOfManufacture} />
                    <DetailItem icon={Archive} label="Equipment Source" value={equipment.equipmentSource} />
                </div>
                <div className="divide-y divide-border">
                    <DetailItem icon={Tag} label="Commitment" value={equipment.commitment} />
                </div>
            </div>
        </div>
        
         <div className="space-y-1 divide-y divide-border md:col-span-2">
           <h3 className="text-lg font-semibold text-foreground pt-4 pb-3 flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-primary" />Record Timestamps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Created At" 
                      value={equipment.createdAt ? format(parseISO(equipment.createdAt), "MMMM d, yyyy 'at' h:mm a") : "N/A"} 
                    />
                </div>
                <div className="divide-y divide-border">
                    <DetailItem 
                      icon={CalendarClock} 
                      label="Last Updated" 
                      value={equipment.updatedAt ? format(parseISO(equipment.updatedAt), "MMMM d, yyyy 'at' h:mm a") : "N/A"} 
                    />
                </div>
            </div>
        </div>

      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-end">
         <Link href="/equipment" passHref>
            <Button variant="ghost">Back to Equipment List</Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
