
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Utensils, Calendar as CalendarIcon, MapPin, Truck, UserCheck, Info } from "lucide-react";
import type { DeliveryNote, DeliveryNoteItem } from "@/types";
import { z } from "zod";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface EditDeliveryNoteFormProps {
  deliveryNote: DeliveryNote;
}

const EditDeliveryNoteSchema = z.object({
  deliveredBy: z.string().min(1, "Delivered by is required"),
  location: z.string().min(1, "Location is required"),
  vehicleRegNo: z.string().optional(),
  deliveryDate: z.string().refine((d) => !!d && isValid(parseISO(d)), "A valid delivery date is required"),
});
type EditDeliveryNoteFormData = z.infer<typeof EditDeliveryNoteSchema>;

export function EditDeliveryNoteForm({ deliveryNote }: EditDeliveryNoteFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { updateDeliveryNote } = useDeliveryNoteStorage();

  const [items, setItems] = useState<DeliveryNoteItem[]>(deliveryNote.items || []);
  const [deliveryMode, setDeliveryMode] = useState<"recipes" | "narration">(deliveryNote.is_narration ? "narration" : "recipes");
  const [narrationText, setNarrationText] = useState(deliveryNote.narration_text || "");

  const form = useForm<EditDeliveryNoteFormData>({
    resolver: zodResolver(EditDeliveryNoteSchema),
    defaultValues: {
      deliveredBy: deliveryNote.delivered_by || "",
      location: deliveryNote.delivery_location || "",
      vehicleRegNo: deliveryNote.vehicle_reg_no || "",
      deliveryDate: deliveryNote.delivery_date ? deliveryNote.delivery_date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
    },
  });

  const handleAddNarration = () => {
    setItems([...items, { qty: 1, itemCode: "N/A", description: "" }]);
  };

  const handleUpdateItem = (index: number, field: keyof DeliveryNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i: number) => i !== index));
  };

  async function onSubmit(data: EditDeliveryNoteFormData) {
    if (deliveryMode === "recipes" && items.length === 0) {
      toast({ variant: "destructive", title: "Missing Items", description: "Please add at least one recipe or narration row." });
      return;
    }
    if (deliveryMode === "narration" && !narrationText.trim()) {
      toast({ variant: "destructive", title: "Missing Narration", description: "Please enter the narration text." });
      return;
    }

    const finalItems = deliveryMode === "narration"
      ? [{ qty: 1, itemCode: "N/A", description: narrationText }]
      : items;

    const updated = await updateDeliveryNote(deliveryNote.id, {
      delivery_date: new Date(data.deliveryDate).toISOString(),
      delivery_location: data.location,
      vehicle_reg_no: data.vehicleRegNo,
      delivered_by: data.deliveredBy,
      items: finalItems,
      is_narration: deliveryMode === "narration",
      narration_text: deliveryMode === "narration" ? narrationText : undefined,
    });

    if (updated) {
      toast({ title: "Success", description: "Delivery note updated successfully." });
      router.push(`/delivery-notes/${deliveryNote.id}`);
    }
  }

  return (
    <Card className="border-primary/20 shadow-md max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Delivery Note {deliveryNote.id}</CardTitle>
        <CardDescription>
          Order: <span className="font-mono">{deliveryNote.order_id}</span> &middot; Client: {deliveryNote.client_name}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <Tabs value={deliveryMode} onValueChange={(v: string) => setDeliveryMode(v as "recipes" | "narration")} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recipes">Detailed Recipes</TabsTrigger>
                <TabsTrigger value="narration">Single Narration</TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2"><CalendarIcon className="h-3.5 w-3.5" /> Delivery Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Delivery Point</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Headquarters Reception" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="vehicleRegNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Vehicle No.</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. T 442 DDZ" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="deliveredBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5" /> Personnel Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Full name of the person delivering the items" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <TabsContent value="recipes" className="space-y-4 pt-6 border-t mt-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Utensils className="h-3.5 w-3.5" /> Table of recipes
                  </h4>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddNarration}>
                    <Plus className="h-3 w-3 mr-1" /> Add Row
                  </Button>
                </div>
                <div className="border rounded-xl overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px] text-center">Qty</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                          <TableCell className="p-1">
                            <Input value={item.description} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input type="number" value={item.qty} onChange={(e) => handleUpdateItem(index, 'qty', parseInt(e.target.value) || 0)} className="text-center" />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground italic">
                            No items yet. Add a row above.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="narration" className="space-y-4 pt-6 border-t mt-6">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
                  <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 font-medium">
                    This narration replaces the recipe list and appears as a single line item on the delivery note.
                  </p>
                </div>
                <FormItem>
                  <FormControl>
                    <Textarea className="min-h-[140px]" value={narrationText} onChange={(e) => setNarrationText(e.target.value)} />
                  </FormControl>
                </FormItem>
              </TabsContent>
            </Tabs>
          </CardContent>
          <div className="flex justify-end gap-4 p-6 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
