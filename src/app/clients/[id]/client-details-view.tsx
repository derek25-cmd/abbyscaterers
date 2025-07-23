
"use client";

import type { Client } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Mail, Phone, MapPin, CalendarDays, Edit, Users, Building, Fingerprint, Briefcase, User, Star } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ClientDetailsViewProps {
  client: Client;
}

export function ClientDetailsView({ client }: ClientDetailsViewProps) {
  
  const DetailItem = ({ icon: Icon, label, value, isLink = false, hrefPrefix = "", className = "" }: { icon: React.ElementType, label: string, value?: string | React.ReactNode, isLink?: boolean, hrefPrefix?: string, className?: string }) => {
    const hasValue = value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== "");

    return (
    <div className={cn("flex items-start space-x-3 py-3", className)}>
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
      <div className="flex-grow"> 
        <p className="text-sm font-medium text-foreground">{label}</p>
        {!hasValue ? (
          <p className="text-sm text-muted-foreground">N/A</p>
        ) : isLink && typeof value === 'string' ? (
          <a href={`${hrefPrefix}${value}`} className="block text-sm text-accent hover:underline">
            {value}
          </a>
        ) : (
          <div className="text-sm text-muted-foreground break-words">
            {value}
          </div>
        )}
      </div>
    </div>
    );
  };

  const formatDateSafe = (dateString?: string, formatString: string = "MMMM d, yyyy") => {
    if (!dateString) return "N/A";
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate) ? format(parsedDate, formatString) : "N/A";
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">{client.companyName}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
                {client.primaryLocation && <CardDescription className="text-md text-accent flex items-center"><Building className="mr-2 h-4 w-4" /> {client.primaryLocation}</CardDescription>}
                {client.typeOfOrganization && <Badge variant="outline">{client.typeOfOrganization}</Badge>}
            </div>
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
           <h3 className="text-lg font-semibold text-foreground flex items-center"><Building className="mr-2 h-5 w-5 text-primary" />Company Information</h3>
          <div className="divide-y divide-border">
            <DetailItem icon={Fingerprint} label="Client ID" value={client.id} />
            <DetailItem icon={Mail} label="Company Email" value={client.companyEmail} isLink hrefPrefix="mailto:" />
            <DetailItem icon={Phone} label="Company Phone" value={client.phoneNumber} isLink hrefPrefix="tel:" />
            <DetailItem icon={Briefcase} label="Type of Organization" value={client.typeOfOrganization}/>
            <DetailItem icon={MapPin} label="Address 1" value={client.address1} />
            {client.address2 && <DetailItem icon={MapPin} label="Address 2" value={client.address2} />}
            <DetailItem icon={MapPin} label="Postal Code" value={client.postalCode} />
            <DetailItem icon={Building} label="Primary Location" value={client.primaryLocation} />
          </div>
        </div>
        
         <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />Contact Persons</h3>
          <div className="space-y-4">
            {client.contacts && client.contacts.length > 0 ? (
                client.contacts.map((contact, index) => (
                    <Card key={index} className="bg-muted/50">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-accent"/>{contact.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-2">
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4"/> {contact.email}</p>
                            <p className="flex items-center gap-2"><Phone className="h-4 w-4"/> {contact.phone}</p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No contact persons listed.</p>
            )}
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
