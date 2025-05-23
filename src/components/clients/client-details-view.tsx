
"use client";

import type { Client } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Mail, Phone, MapPin, CalendarDays, Edit, Users, Building, Fingerprint } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ClientDetailsViewProps {
  client: Client;
}

export function ClientDetailsView({ client }: ClientDetailsViewProps) {
  
  const DetailItem = ({ icon: Icon, label, value, isLink = false, hrefPrefix = "", className = "" }: { icon: React.ElementType, label: string, value?: string | React.ReactNode, isLink?: boolean, hrefPrefix?: string, className?: string }) => {
    const hasValue = value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== "");

    return (
    <div className={cn("flex items-center space-x-3 py-3", className)}> 
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-grow"> 
        <p className="text-sm font-medium text-foreground text-center">{label}</p>
        {!hasValue ? (
          <p className="text-sm text-muted-foreground text-center">N/A</p> 
        ) : isLink && typeof value === 'string' ? (
          <a href={`${hrefPrefix}${value}`} className="block text-sm text-accent hover:underline text-center">
            {value}
          </a>
        ) : (
          <div className="text-sm text-muted-foreground text-center break-words"> 
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
            <CardTitle className="text-2xl font-bold text-primary">{client.companyName}</CardTitle>
            {client.primaryLocation && <CardDescription className="text-md text-accent flex items-center"><Building className="mr-2 h-4 w-4" /> {client.primaryLocation}</CardDescription>}
          </div>
          <Link href={`/clients/${client.id}/edit`} passHref>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Client
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="space-y-4">
           <h3 className="text-lg font-semibold text-foreground flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Contact Information</h3>
          <div className="divide-y divide-border">
            <DetailItem icon={Fingerprint} label="Client ID" value={client.id} className="md:col-span-2"/>
            <DetailItem icon={Mail} label="Company Email" value={client.companyEmail} isLink hrefPrefix="mailto:" />
            <DetailItem icon={Phone} label="Phone Number" value={client.phoneNumber} isLink hrefPrefix="tel:" />
            <DetailItem icon={MapPin} label="Address 1" value={client.address1} />
            {client.address2 && <DetailItem icon={MapPin} label="Address 2" value={client.address2} />}
            <DetailItem icon={Building} label="Primary Location" value={client.primaryLocation} />
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Activity</h3>
          <div className="divide-y divide-border">
            <DetailItem 
              icon={CalendarDays} 
              label="Last Contacted" 
              value={client.lastContacted ? format(parseISO(client.lastContacted), "MMMM d, yyyy") : "N/A"} 
            />
            <DetailItem 
              icon={CalendarDays} 
              label="Client Since" 
              value={client.createdAt ? format(parseISO(client.createdAt), "MMMM d, yyyy") : "N/A"} 
            />
            <DetailItem 
              icon={CalendarDays} 
              label="Profile Last Updated" 
              value={client.updatedAt ? format(parseISO(client.updatedAt), "MMMM d, yyyy 'at' h:mm a") : "N/A"} 
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6 flex justify-end">
         <Link href="/clients" passHref>
            <Button variant="ghost">Back to Client List</Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
