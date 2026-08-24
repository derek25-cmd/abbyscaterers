
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Utensils, Calendar, MapPin, Truck, UserCheck, Info } from "lucide-react";
import type { Order, DeliveryNoteItem, DailyMenu } from "@/types";
import { z } from "zod";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getMenusByOrderId } from "@/services/dailyMenuService";

interface CreateDeliveryNoteDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: Order;
}

const DeliveryNoteDialogSchema = z.object({
  vehicleRegNo: z.string().optional(),
  deliveredBy: z.string().min(1, "Delivered by is required"),
  location: z.string().min(1, "Location is required"),
  eventIndex: z.string().min(1, "Please select an event"),
});
type DeliveryNoteDialogFormData = z.infer<typeof DeliveryNoteDialogSchema>;

export function CreateDeliveryNoteDialog({ isOpen, setIsOpen, order }: CreateDeliveryNoteDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { addDeliveryNote } = useDeliveryNoteStorage();
  const { getClientById } = useClientStorage();
  const { recipes: allRecipes, getRecipeById } = useRecipeStorage();
  
  const [items, setItems] = useState<DeliveryNoteItem[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<"recipes" | "narration">("recipes");
  const [narrationText, setNarrationText] = useState("");
  const [plannerMenus, setPlannerMenus] = useState<DailyMenu[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(false);

  const form = useForm<DeliveryNoteDialogFormData>({
    resolver: zodResolver(DeliveryNoteDialogSchema),
    defaultValues: {
      vehicleRegNo: "",
      deliveredBy: "",
      location: "",
      eventIndex: "",
    }
  });

  const selectedEventIdx = form.watch("eventIndex");

  // Fetch all planner menus for this order once
  useEffect(() => {
    async function fetchPlannerMenus() {
      if (!order?.id) return;
      setLoadingMenus(true);
      try {
        const menus = await getMenusByOrderId(order.id);
        setPlannerMenus(menus);
      } catch (err) {
        console.error("Error fetching planner menus:", err);
      } finally {
        setLoadingMenus(false);
      }
    }
    fetchPlannerMenus();
  }, [order.id]);

  useEffect(() => {
    if (selectedEventIdx !== "") {
      const idx = parseInt(selectedEventIdx, 10);
      const event = order.clientEvents[idx];
      if (event) {
        const clientId = event.clientId || order.clientId;
        const client = getClientById(clientId);
        if (client?.primaryLocation) {
          form.setValue("location", client.primaryLocation);
        }

        // Merge logic: Base Order Recipes + Planner Recipes
        const baseRecipes = event.recipes || [];
        const plannerMenu = plannerMenus.find(m => m.event_id === event.id);
        const plannerRecipes = (plannerMenu?.recipes || []).map(pr => ({ recipeId: pr.recipeId }));
        
        // Combine & Deduplicate by recipeId
        const combined = [...baseRecipes];
        plannerRecipes.forEach(pr => {
          if (!combined.some(br => br.recipeId === pr.recipeId)) {
            combined.push(pr as any);
          }
        });

        const initialItems: DeliveryNoteItem[] = combined.map(r => {
            const recipe = getRecipeById(r.recipeId);
            return {
                qty: event.numberOfPeople || 0,
                itemCode: r.recipeId,
                description: recipe?.recipeName || "Unknown Recipe"
            };
        });
        setItems(initialItems);
        
        setNarrationText(`Catering services for ${event.mealType} at ${event.region} on ${event.date ? format(parseISO(event.date), "PPP") : 'scheduled date'}.`);
      }
    }
  }, [selectedEventIdx, order, getClientById, getRecipeById, form, plannerMenus]);

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

  async function onSubmit(data: DeliveryNoteDialogFormData) {
    if (deliveryMode === "recipes" && items.length === 0) {
        toast({ variant: "destructive", title: "Missing Items", description: "Please add at least one recipe or narration row." });
        return;
    }
    if (deliveryMode === "narration" && !narrationText.trim()) {
        toast({ variant: "destructive", title: "Missing Narration", description: "Please enter the narration text." });
        return;
    }

    try {
      const finalItems = deliveryMode === "narration" 
        ? [{ qty: 1, itemCode: "N/A", description: narrationText }]
        : items;

      const newNotes = await addDeliveryNote(order, {
        ...data,
        eventIndex: parseInt(data.eventIndex, 10),
        items: finalItems,
        is_narration: deliveryMode === "narration",
        narration_text: deliveryMode === "narration" ? narrationText : undefined
      });

      if (newNotes && newNotes.length > 0) {
        toast({ title: "Success", description: `Delivery note created successfully.` });
        setIsOpen(false);
        form.reset();
        setItems([]);
        setNarrationText("");
        router.push(`/delivery-notes/${newNotes[0].id}`);
      }
    } catch (error) {
      console.error("Failed to create delivery note:", error);
      toast({ variant: "destructive", title: "System Error", description: "An unexpected error occurred while generating the delivery note." });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v: boolean) => { setIsOpen(v); if(!v) { form.reset(); setItems([]); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-r from-primary to-indigo-600 p-8 text-white relative flex-shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Utensils className="h-24 w-24" /></div>
            <DialogHeader>
                <DialogTitle className="text-3xl font-black tracking-tight leading-none mb-2 text-white">Issue Delivery Note</DialogTitle>
                <DialogDescription className="text-white/80 font-medium text-base">
                    Create a specific delivery note for an event within order: <span className="text-white font-bold">{order.name}</span>.
                </DialogDescription>
            </DialogHeader>
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50/50 scrollbar-thin">
                <div className="space-y-6">
                    <Tabs defaultValue="recipes" onValueChange={(v: string) => setDeliveryMode(v as "recipes" | "narration")} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-14 bg-white/80 backdrop-blur border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
                            <TabsTrigger value="recipes" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Detailed Recipes</TabsTrigger>
                            <TabsTrigger value="narration" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Single Narration</TabsTrigger>
                        </TabsList>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            <FormField
                                control={form.control}
                                name="eventIndex"
                                render={({ field }) => (
                                    <FormItem className="col-span-1 md:col-span-2">
                                        <FormLabel className="font-extrabold uppercase text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                            <Calendar className="h-3 w-3" /> Select Event
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-14 bg-white border-2 border-slate-100 rounded-xl focus:ring-primary shadow-sm hover:border-primary/20 transition-all font-semibold">
                                                    <SelectValue placeholder="Select which ceremony/meal time is being delivered..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {order.clientEvents.map((event: any, idx: number) => (
                                                    <SelectItem key={idx} value={String(idx)} className="py-3 rounded-lg">
                                                        {event.date ? format(parseISO(event.date), "EEEE, MMM d, yyyy") : `Event ${idx + 1}`} - <span className="font-bold">{event.mealType}</span> ({event.region})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-xs font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-extrabold uppercase text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                            <MapPin className="h-3 w-3" /> Delivery Point
                                        </FormLabel>
                                        <FormControl><Input {...field} className="h-14 bg-white border-2 border-slate-100 rounded-xl focus:ring-primary shadow-sm" placeholder="e.g. Headquarters Reception"/></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vehicleRegNo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-extrabold uppercase text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                            <Truck className="h-3 w-3" /> Vehicle No.
                                        </FormLabel>
                                        <FormControl><Input {...field} className="h-14 bg-white border-2 border-slate-100 rounded-xl focus:ring-primary shadow-sm" placeholder="e.g. T 442 DDZ"/></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="deliveredBy"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="font-extrabold uppercase text-[10px] tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                            <UserCheck className="h-3 w-3" /> Personnel Name
                                        </FormLabel>
                                        <FormControl><Input {...field} className="h-14 bg-white border-2 border-slate-100 rounded-xl focus:ring-primary shadow-sm" placeholder="Full name of the person delivering the items"/></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <TabsContent value="recipes" className="space-y-4 pt-8 border-t-2 border-slate-100/50 mt-10">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary flex items-center gap-2">
                                    <Utensils className="h-3.5 w-3.5" /> Table of recipes
                                </h4>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddNarration} className="h-10 text-[10px] font-black border-2 border-dashed border-slate-200 hover:border-primary hover:text-primary rounded-xl px-4 transition-all">
                                    <Plus className="h-3 w-3 mr-1" /> ADD EXTRA ROW
                                </Button>
                            </div>

                            <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest px-6 h-12">ID</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Description</TableHead>
                                            <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-center h-12">Qty</TableHead>
                                            <TableHead className="w-[60px] h-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item: DeliveryNoteItem, index: number) => (
                                            <TableRow key={index} className="group hover:bg-slate-50/50 transition-colors border-b-slate-100 last:border-0 h-16">
                                                <TableCell className="font-mono text-[11px] text-muted-foreground px-6">
                                                    {item.itemCode === "N/A" ? (
                                                        <span className="bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-black text-[9px] border border-slate-200">N/A</span>
                                                    ) : (
                                                        item.itemCode
                                                    )}
                                                </TableCell>
                                                <TableCell className="p-0">
                                                    <Input 
                                                        value={item.description} 
                                                        onChange={(e: any) => handleUpdateItem(index, 'description', e.target.value)}
                                                        placeholder={item.itemCode === "N/A" ? "Enter extra item/narration details..." : "Item name"}
                                                        className="h-full border-none focus-visible:ring-0 bg-transparent text-sm font-semibold px-4"
                                                    />
                                                </TableCell>
                                                <TableCell className="p-0">
                                                    <Input 
                                                        type="number" 
                                                        value={item.qty} 
                                                        onChange={(e: any) => handleUpdateItem(index, 'qty', parseInt(e.target.value) || 0)}
                                                        className="h-full border-none focus-visible:ring-0 bg-transparent text-sm text-center font-bold"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-sm text-muted-foreground font-medium italic">
                                                    Please select an event above to automatically load recipes...
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="narration" className="space-y-4 pt-8 border-t-2 border-slate-100/50 mt-10">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Summary Narration Memo</h4>
                            </div>
                            <div className="bg-blue-50/50 p-4 rounded-xl border-2 border-blue-100 flex gap-3 items-start mb-6">
                                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                    This narration will replace the recipe list and appear as a **single line item** on the delivery note. All other table rows will remain blank as per system requirements.
                                </p>
                            </div>
                            <FormItem>
                                <FormControl>
                                    <Textarea 
                                        className="min-h-[160px] p-6 rounded-2xl border-2 border-slate-100 focus:border-primary shadow-sm font-semibold text-base leading-relaxed"
                                        placeholder="Catering services provided for breakfast and lunch as per agreement and service standard..."
                                        value={narrationText}
                                        onChange={(e: any) => setNarrationText(e.target.value)}
                                    />
                                </FormControl>
                            </FormItem>
                        </TabsContent>
                    </Tabs>
                </div>
                </div>

                <DialogFooter className="py-6 px-8 border-t-2 border-slate-100 bg-white/80 backdrop-blur-xl flex-shrink-0">
                    <Button type="button" variant="ghost" className="h-14 px-10 font-black text-xs uppercase tracking-widest text-muted-foreground hover:text-slate-900 transition-all" onClick={() => { setIsOpen(false); form.reset(); setItems([]); }} disabled={form.formState.isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" size="lg" className="h-14 font-black px-14 shadow-2xl shadow-primary/40 bg-gradient-to-r from-primary to-indigo-700 hover:from-black hover:to-slate-800 rounded-2xl text-xs uppercase tracking-[0.2em] transform active:scale-95 transition-all flex items-center gap-3" disabled={form.formState.isSubmitting || !selectedEventIdx}>
                        {form.formState.isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                            <Truck className="h-4 w-4" />
                        )}
                        GENERATE DELIVERY NOTE
                    </Button>
                </DialogFooter>
            </form>
            </Form>
      </DialogContent>
    </Dialog>
  );
}
