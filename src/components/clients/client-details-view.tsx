"use client";

import type { Client } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Mail, Phone, Building, MapPin, CalendarDays, Edit, Users, Info, FileText } from "lucide-react";
import { DietaryAnalysisDisplay } from "./dietary-analysis-display";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ClientDetailsViewProps {
  client: Client;
}

export function ClientDetailsView({ client }: ClientDetailsViewProps) {
  
  const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | React.ReactNode }) => (
    <div className="flex items-start space-x-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {typeof value === 'string' ? <p className="text-sm text-muted-foreground">{value || "N/A"}</p> : value}
      </div>
    </div>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">{client.fullName}</CardTitle>
            {client.company && <CardDescription className="text-md text-accent">{client.company}</CardDescription>}
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
          <DetailItem icon={Mail} label="Email" value={<a href={`mailto:${client.email}`} className="text-accent hover:underline">{client.email}</a>} />
          <DetailItem icon={Phone} label="Phone" value={<a href={`tel:${client.phone}`} className="text-accent hover:underline">{client.phone}</a>} />
          <DetailItem icon={MapPin} label="Address" value={client.address} />
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Activity</h3>
          <DetailItem 
            icon={CalendarDays} 
            label="Last Contacted" 
            value={format(parseISO(client.lastContacted), "MMMM d, yyyy")} 
          />
           <DetailItem 
            icon={CalendarDays} 
            label="Client Since" 
            value={format(parseISO(client.createdAt), "MMMM d, yyyy")} 
          />
          <DetailItem 
            icon={CalendarDays} 
            label="Profile Last Updated" 
            value={format(parseISO(client.updatedAt), "MMMM d, yyyy 'at' h:mm a")} 
          />
        </div>

        <div className="md:col-span-2 space-y-4">
           <h3 className="text-lg font-semibold text-foreground flex items-center"><FileText className="mr-2 h-5 w-5 text-primary" />Preferences & Notes</h3>
          <DetailItem icon={Info} label="Event Preferences" value={client.eventPreferences || "No specific preferences noted."} />
        </div>
        
        <div className="md:col-span-2">
           <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Dietary Information</h3>
          {client.dietaryRestrictionsRaw && client.dietaryRestrictionsRaw.trim() !== "" ? (
            <Card className="bg-secondary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-md">Raw Input</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">{client.dietaryRestrictionsRaw}</p>
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">No raw dietary restrictions provided.</p>
          }
          <DietaryAnalysisDisplay classifications={client.dietaryClassifications} rawText={client.dietaryRestrictionsRaw} />
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
