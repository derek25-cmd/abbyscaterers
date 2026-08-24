
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { CateringMenu, MenuType } from "@/types";
import { CateringMenuSchema, type CateringMenuFormData } from "@/lib/schemas";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users, DollarSign, NotebookPen, Utensils, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    menuTypes: MenuType[];
    menu?: CateringMenu | null;
    onSubmit: (data: CateringMenuFormData) => Promise<void>;
}

export function MenuFormDialog({ open, onOpenChange, menuTypes, menu, onSubmit }: MenuFormDialogProps) {
    const isEditing = !!menu;

    const form = useForm<CateringMenuFormData>({
        resolver: zodResolver(CateringMenuSchema),
        defaultValues: {
            name: "",
            menu_type_id: "",
            base_people: 40,
            price_per_person: 0,
            notes: "",
        },
    });

    // Watch values for preview calculation
    const watchPeople = form.watch("base_people") || 0;
    const watchPrice = form.watch("price_per_person") || 0;
    const revenuePreview = watchPeople * watchPrice;

    useEffect(() => {
        if (open) {
            if (menu) {
                form.reset({
                    name: menu.name,
                    menu_type_id: menu.menu_type_id,
                    base_people: menu.base_people,
                    price_per_person: Number(menu.price_per_person),
                    notes: menu.notes || "",
                });
            } else {
                form.reset({
                    name: "",
                    menu_type_id: menuTypes[0]?.id || "",
                    base_people: 40,
                    price_per_person: 0,
                    notes: "",
                });
            }
        }
    }, [open, menu, menuTypes, form]);

    const handleSubmit = async (data: CateringMenuFormData) => {
        await onSubmit(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] rounded-[2.5rem]">
                <div className="bg-primary p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Sparkles className="h-24 w-24" />
                    </div>
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                            {isEditing ? <NotebookPen className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                            {isEditing ? "Edit Menu Package" : "Create Master Menu"}
                        </DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 font-medium">
                            {isEditing
                                ? "Refine your catering package details and pricing."
                                : "Configure a new standard menu with base metrics."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Menu Name</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Utensils className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                <Input 
                                                    placeholder="e.g. Signature Breakfast Buffet" 
                                                    className="pl-10 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all font-bold"
                                                    {...field} 
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="menu_type_id"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Menu Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all font-bold capitalize">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl overflow-hidden shadow-xl border-none">
                                                {menuTypes.map(mt => (
                                                    <SelectItem key={mt.id} value={mt.id} className="capitalize py-3 font-medium">
                                                        {mt.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="base_people"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base PAX</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <Users className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                    <Input
                                                        type="number" min={1}
                                                        className="pl-10 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all font-mono font-bold"
                                                        {...field}
                                                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="price_per_person"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Price / PAX</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <div className="absolute left-3.5 top-3.5 text-muted-foreground group-focus-within:text-primary transition-colors font-bold text-xs">TZS</div>
                                                    <Input
                                                        type="number" step="0.01" min={0}
                                                        className="pl-12 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all font-mono font-bold"
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Revenue Preview Logic */}
                            <motion.div 
                                layout
                                className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 flex items-center justify-between"
                            >
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800/60">Base Revenue</p>
                                    <p className="text-sm font-black text-emerald-900 uppercase">Estimated Proceeds</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xl font-black font-mono text-emerald-700">
                                        TZS {revenuePreview.toLocaleString()}
                                    </span>
                                </div>
                            </motion.div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Notes</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Menu theme, setup requirements, etc..."
                                                className="rounded-2xl border-muted bg-muted/20 focus:bg-white transition-all font-medium py-3 min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter className="pt-4 border-t border-muted/50">
                                <Button 
                                    type="button" variant="ghost" 
                                    onClick={() => onOpenChange(false)}
                                    className="rounded-xl h-12 px-6 font-bold text-muted-foreground hover:bg-muted"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" disabled={form.formState.isSubmitting}
                                    className="rounded-xl h-12 px-8 font-black shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                                >
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isEditing ? "Update Package" : "Publish Menu"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
