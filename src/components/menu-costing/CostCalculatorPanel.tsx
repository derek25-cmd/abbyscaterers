
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CateringMenu, CateringMenuRecipe, MenuCalculationResult, IngredientSummaryItem, PlannedVsCalculated } from "@/types";
import { exportMenuCostingPdf } from "@/lib/menuCostingPdf";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Calculator, Loader2, TrendingUp, TrendingDown, DollarSign,
    Percent, AlertTriangle, FileText, BarChart3, Users, ArrowUpDown,
    ArrowUp, ArrowDown, Minus, Sparkles, Wand2, Info, ShoppingBasket
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CostCalculatorPanelProps {
    menu: CateringMenu;
    menuRecipes: CateringMenuRecipe[];
    calculationResult: MenuCalculationResult | null;
    isCalculating: boolean;
    onCalculate: (people: number, useWastage: boolean) => Promise<MenuCalculationResult | null>;
    onClearResults: () => void;
}

export function CostCalculatorPanel({
    menu, menuRecipes, calculationResult, isCalculating,
    onCalculate, onClearResults
}: CostCalculatorPanelProps) {
    const [people, setPeople] = useState<number>(menu.base_people);
    const [useWastage, setUseWastage] = useState(false);
    const { toast } = useToast();
    const resultRef = useRef<HTMLDivElement>(null);

    const handleCalculate = async () => {
        if (menuRecipes.length === 0) {
            toast({
                variant: "destructive",
                title: "No Recipes",
                description: "Add at least one recipe to the menu before calculating.",
            });
            return;
        }
        try {
            const res = await onCalculate(people, useWastage);
            if (res) {
                // Smooth scroll to results
                setTimeout(() => {
                    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Calculation Error",
                description: error.message || "An error occurred during calculation.",
            });
        }
    };

    const handleExportPdf = () => {
        if (!calculationResult) return;
        try {
            exportMenuCostingPdf(menu, people, useWastage, calculationResult);
            toast({ title: "PDF Exported", description: "Costing report has been exported." });
        } catch (error) {
            console.error("PDF export error:", error);
            toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF." });
        }
    };

    const getMarginStyle = (margin: number) => {
        if (margin < 0) return { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "🔴", label: "Loss", theme: "red" };
        if (margin < 20) return { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "🟡", label: "Low Margin", theme: "amber" };
        return { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: "🟢", label: "Healthy", theme: "emerald" };
    };

    const scalingFactor = menu.base_people > 0 ? (people / menu.base_people) : 1;
    const hasComparison = calculationResult?.plannedComparison && calculationResult.plannedComparison.length > 0;

    return (
        <div className="space-y-6">
            {/* ─── Calculator Inputs ─── */}
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white ring-1 ring-muted">
                <CardHeader className="pb-4 pt-8 px-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Calculator className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Cost Calculator</CardTitle>
                            <CardDescription>Scale headcount and compute professional margins.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-8">
                    {/* People Input - Premium Slider */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Guest Count
                            </Label>
                            <div className="px-3 py-1 bg-muted rounded-lg font-black text-xs">
                                {scalingFactor.toFixed(2)}× SCALE
                            </div>
                        </div>
                        <div className="flex items-center gap-6 p-6 bg-muted/20 rounded-3xl border border-muted/50">
                            <div className="relative">
                                <Input
                                    type="number" min={1} max={10000}
                                    value={people}
                                    onChange={(e) => setPeople(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-24 h-14 text-2xl font-black text-center rounded-2xl border-none shadow-inner bg-white pr-2"
                                />
                                <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">PAX</div>
                            </div>
                            <Slider
                                value={[people]}
                                onValueChange={([val]) => setPeople(val)}
                                min={1}
                                max={Math.max(500, people + 100)}
                                step={1}
                                className="flex-1"
                            />
                        </div>
                        {scalingFactor !== 1 && (
                            <div className="flex justify-end pr-4">
                                <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1",
                                    scalingFactor > 1 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
                                )}>
                                    {scalingFactor > 1 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {scalingFactor > 1 ? "Bulk Scale Active" : "Small Batch Scaling"}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={cn(
                            "flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300",
                            useWastage ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-white"
                        )}>
                            <div className="space-y-0.5">
                                <Label htmlFor="wastage-toggle" className="text-sm font-bold cursor-pointer">Wastage Buffer</Label>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Adds 10% safety margin</p>
                            </div>
                            <Switch
                                id="wastage-toggle"
                                checked={useWastage}
                                onCheckedChange={setUseWastage}
                            />
                        </div>

                        <Button
                            onClick={handleCalculate}
                            disabled={isCalculating || menuRecipes.length === 0}
                            className="h-full rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all py-6 gap-3 group"
                        >
                            {isCalculating ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Wand2 className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                            )}
                            <span className="font-black text-lg">Calculate Results</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Results ─── */}
            <div ref={resultRef}>
                <AnimatePresence mode="wait">
                    {!calculationResult ? (
                        !isCalculating && (
                            <motion.div 
                                key="empty"
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }}
                                className="py-20 text-center space-y-4"
                            >
                                <div className="p-4 bg-muted/20 rounded-full w-fit mx-auto">
                                    <BarChart3 className="h-10 w-10 text-muted-foreground/20" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-muted-foreground/60 tracking-tight">Ready to analyze?</h3>
                                    <p className="text-sm text-muted-foreground/40 font-medium">Configure guest count and wastage then hit Calculate.</p>
                                </div>
                            </motion.div>
                        )
                    ) : (() => {
                        const res = calculationResult; // Narrowed reference
                        return (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="space-y-6"
                            >
                                {/* Sticky Summary Strip */}
                                <div className="sticky top-4 z-50 px-2 pointer-events-none">
                                    <motion.div 
                                        initial={{ y: -100 }}
                                        animate={{ y: 0 }}
                                        className="bg-white/80 backdrop-blur-xl border border-muted shadow-2xl rounded-2xl p-2 flex items-center justify-between gap-4 pointer-events-auto"
                                    >
                                        <div className="flex items-center gap-6 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Planned Profit</span>
                                                <span className={cn("text-lg font-black font-mono", res.plannedProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                    TZS {res.plannedProfit.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-8 w-px bg-muted" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Estimate Profit</span>
                                                <span className={cn("text-sm font-bold font-mono text-muted-foreground")}>
                                                    TZS {res.profit.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-8 w-px bg-muted" />
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Margin</span>
                                                <div className="flex items-baseline gap-2">
                                                    <span className={cn("text-lg font-black font-mono", getMarginStyle(res.plannedMargin).text)}>
                                                        {res.plannedMargin}%
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60">{res.margin}% EST</span>
                                                </div>
                                            </div>
                                            {res.efficiencyFactor !== 1 && (
                                                <>
                                                    <div className="h-8 w-px bg-muted" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Efficiency</span>
                                                        <Badge variant="outline" className={cn(
                                                            "h-5 border-none px-0 text-[10px] font-black",
                                                            res.efficiencyFactor < 1 ? "text-emerald-600" : "text-amber-600"
                                                        )}>
                                                            {res.efficiencyFactor < 1 ? "+" : "-"}{Math.abs(Math.round((1 - res.efficiencyFactor) * 100))}%
                                                        </Badge>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl h-10 px-4 font-bold text-xs uppercase tracking-widest text-primary">
                                                View Details
                                            </Button>
                                            <Button size="sm" onClick={handleExportPdf} className="rounded-xl h-10 px-4 font-bold text-xs uppercase tracking-widest gap-2">
                                                <FileText className="h-4 w-4" />
                                                Export
                                            </Button>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Summary Cards Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MetricCard 
                                        label="Gross Cost" 
                                        value={res.plannedTotalCost} 
                                        icon={ShoppingBasket} 
                                        suffix="TZS"
                                        subtext={`EST: TZS ${res.totalCost.toLocaleString()}`}
                                    />
                                    <MetricCard 
                                        label="Set Price (Revenue)" 
                                        value={res.revenue} 
                                        icon={TrendingUp} 
                                        suffix="TZS"
                                        theme="blue"
                                        subtext={`${menu.price_per_person} / PAX`}
                                    />
                                    <MetricCard 
                                        label="Planned Profit" 
                                        value={res.plannedProfit} 
                                        icon={res.plannedProfit >= 0 ? DollarSign : TrendingDown} 
                                        suffix="TZS"
                                        theme={res.plannedProfit >= 0 ? "emerald" : "red"}
                                        subtext={`EST: TZS ${res.profit.toLocaleString()}`}
                                    />
                                    <MetricCard 
                                        label="Planned Margin" 
                                        value={res.plannedMargin} 
                                        icon={Percent} 
                                        suffix="%"
                                        theme={getMarginStyle(res.plannedMargin).theme as any}
                                        subtext={`EST: ${res.margin}%`}
                                    />
                                </div>

                                {/* Unpriced Warning */}
                                {res.ingredientsSummary.some(i => i.unitCost === 0) && (
                                    <motion.div 
                                        layout
                                        className="flex items-start gap-4 p-5 rounded-3xl border-2 border-amber-200 bg-amber-50/50 backdrop-blur-sm"
                                    >
                                        <div className="p-2 bg-amber-200 rounded-xl">
                                            <AlertTriangle className="h-5 w-5 text-amber-700" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Incomplete Data Detected</p>
                                            <p className="text-xs text-amber-800 font-medium mt-1 leading-relaxed">
                                                The following items lack pricing in your Product Catalog. Calculation assumes 0 cost for them:
                                                <br />
                                                <span className="font-black">{res.ingredientsSummary.filter(i => i.unitCost === 0).map(i => i.ingredient).join(", ")}</span>
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Detailed Analysis Tables */}
                                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-muted">
                                    <CardHeader className="flex flex-row items-center justify-between px-8 py-8 border-b border-muted">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl">Ingredient Analysis</CardTitle>
                                            <CardDescription>Deep dive into quantities and cost variances.</CardDescription>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={onClearResults} className="rounded-xl h-9 px-4 font-bold text-[10px] uppercase tracking-widest border-muted hover:bg-muted font-mono">
                                            Reset View
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {hasComparison ? (
                                            <Tabs defaultValue="comparison" className="w-full">
                                                <div className="px-8 pt-6 pb-2">
                                                    <TabsList className="bg-muted p-1 rounded-xl h-11 w-full md:w-fit gap-1">
                                                        <TabsTrigger value="comparison" className="rounded-lg h-9 px-4 font-bold data-[state=active]:bg-white">
                                                            Comparison View
                                                        </TabsTrigger>
                                                        <TabsTrigger value="calculated" className="rounded-lg h-9 px-4 font-bold data-[state=active]:bg-white">
                                                            Detailed Estimate
                                                        </TabsTrigger>
                                                    </TabsList>
                                                </div>

                                                <TabsContent value="comparison" className="m-0 border-none">
                                                    <div className="overflow-x-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="border-none hover:bg-transparent bg-muted/30">
                                                                    <TableHead className="px-8 h-12 uppercase text-[9px] font-black tracking-widest text-muted-foreground">Item</TableHead>
                                                                    <TableHead className="px-4 h-12 text-right uppercase text-[9px] font-black tracking-widest text-muted-foreground">Planned Qty (Scaled)</TableHead>
                                                                    <TableHead className="px-4 h-12 text-right uppercase text-[9px] font-black tracking-widest text-muted-foreground">Estimate Qty</TableHead>
                                                                    <TableHead className="px-4 h-12 text-right uppercase text-[9px] font-black tracking-widest text-muted-foreground">Planned Cost</TableHead>
                                                                    <TableHead className="px-4 h-12 text-right uppercase text-[9px] font-black tracking-widest text-muted-foreground">Estimate Cost</TableHead>
                                                                    <TableHead className="px-8 h-12 text-right uppercase text-[9px] font-black tracking-widest text-muted-foreground">Variance</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {['ingredient', 'miscellaneous'].map(cat => {
                                                                    const items = res.plannedComparison!.filter(i => i.category === cat);
                                                                    if (items.length === 0) return null;

                                                                    return (
                                                                        <React.Fragment key={cat}>
                                                                            <TableRow className="bg-muted/10 border-none hover:bg-muted/10">
                                                                                <TableCell colSpan={6} className="px-8 py-2">
                                                                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                                                                        {cat === 'ingredient' ? "🍳 Food Ingredients" : "📦 Miscellaneous Costs"}
                                                                                    </span>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                            {items.map((row, idx) => (
                                                                                <TableRow key={`${cat}-${idx}`} className="hover:bg-muted/10 border-muted/50">
                                                                                    <TableCell className="px-8 py-4">
                                                                                        <div>
                                                                                            <p className="font-bold text-sm tracking-tight">{row.ingredient}</p>
                                                                                            <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase tracking-tighter opacity-60 rounded-[4px]">{row.unit}</Badge>
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell className="px-4 py-4 text-right font-mono text-xs text-muted-foreground">{row.plannedQty.toLocaleString()}</TableCell>
                                                                                    <TableCell className="px-4 py-4 text-right font-mono text-sm font-bold">{row.calculatedQty.toLocaleString()}</TableCell>
                                                                                    <TableCell className="px-4 py-4 text-right font-mono text-xs text-muted-foreground">{row.plannedCost.toLocaleString()}</TableCell>
                                                                                    <TableCell className="px-4 py-4 text-right font-mono text-sm font-bold uppercase">{row.calculatedCost.toLocaleString()}</TableCell>
                                                                                    <TableCell className="px-8 py-4 text-right">
                                                                                        <DiffIndicator value={row.costDifference} isCost />
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="calculated" className="m-0 border-none">
                                                    <CalculatedIngredientsTable
                                                        ingredients={res.ingredientsSummary}
                                                        totalCost={res.totalCost}
                                                    />
                                                </TabsContent>
                                            </Tabs>
                                        ) : (
                                            <CalculatedIngredientsTable
                                                ingredients={res.ingredientsSummary}
                                                totalCost={res.totalCost}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ─── Refined Tables ───

function CalculatedIngredientsTable({ ingredients, totalCost }: { ingredients: IngredientSummaryItem[]; totalCost: number }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-none hover:bg-transparent bg-muted/30">
                        <TableHead className="px-8 h-12 uppercase text-[10px] font-black tracking-widest text-muted-foreground">Ingredient</TableHead>
                        <TableHead className="px-4 h-12 text-right uppercase text-[10px] font-black tracking-widest text-muted-foreground">Quantity</TableHead>
                        <TableHead className="px-4 h-12 text-right uppercase text-[10px] font-black tracking-widest text-muted-foreground">Unit Cost</TableHead>
                        <TableHead className="px-8 h-12 text-right uppercase text-[10px] font-black tracking-widest text-muted-foreground">Total Extension</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ingredients.map((item, idx) => (
                        <TableRow key={idx} className={cn("hover:bg-muted/10 border-muted/50", item.unitCost === 0 && "bg-amber-50/30")}>
                            <TableCell className="px-8 py-4">
                                <p className="font-bold text-sm tracking-tight">{item.ingredient}</p>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right font-mono text-sm leading-none pt-5">
                                <span className="font-bold">{item.totalQuantity.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5 uppercase font-black opacity-50 tracking-tighter">{item.unit}</span>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right font-mono text-sm">
                                {item.unitCost === 0 ? <span className="text-amber-600 font-black">N/A</span> : item.unitCost.toLocaleString()}
                            </TableCell>
                            <TableCell className="px-8 py-4 text-right font-mono text-sm font-black">
                                {item.totalCost.toLocaleString()}
                            </TableCell>
                        </TableRow>
                    ))}
                    <TableRow className="bg-primary/5 hover:bg-primary/10 border-none">
                        <TableCell colSpan={3} className="px-8 py-6 text-right font-black uppercase text-xs tracking-widest text-primary">Aggregate Menu Cost</TableCell>
                        <TableCell className="px-8 py-6 text-right font-mono text-xl font-black text-primary">
                            TZS {totalCost.toLocaleString()}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}

// ─── Diff Indicator ───

const DiffIndicator = ({ value, isCost }: { value: number; isCost?: boolean }) => {
    if (Math.abs(value) < 0.01) return <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">Balanced</span>;
    
    const isPositive = value > 0;
    const color = isCost
        ? (isPositive ? "text-red-600 bg-red-100/50" : "text-emerald-600 bg-emerald-100/50")
        : (isPositive ? "text-amber-600 bg-amber-100/50" : "text-emerald-600 bg-emerald-100/50");
    
    const Icon = isPositive ? ArrowUp : ArrowDown;
    
    return (
        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs font-mono", color)}>
            <Icon className="h-3 w-3" strokeWidth={3} />
            {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
    );
};

// ─── Metric Card ───

function MetricCard({
    label, value, icon: Icon, theme = "gray", suffix = "", subtext
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    theme?: "gray" | "blue" | "emerald" | "red" | "amber";
    suffix?: string;
    subtext?: string;
}) {
    const themes = {
        gray: "bg-white text-foreground ring-muted shadow-sm",
        blue: "bg-blue-50 text-blue-900 ring-blue-100 shadow-blue-900/5",
        emerald: "bg-emerald-50 text-emerald-900 ring-emerald-100 shadow-emerald-900/5",
        red: "bg-red-50 text-red-900 ring-red-100 shadow-red-900/5",
        amber: "bg-amber-50 text-amber-900 ring-amber-100 shadow-amber-900/5",
    };

    return (
        <Card className={cn("border-none ring-1 rounded-[2rem] overflow-hidden transition-all duration-300 hover:shadow-xl", themes[theme])}>
            <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
                    <div className="p-2 bg-white/50 rounded-xl shadow-inner ring-1 ring-black/5">
                        <Icon className="h-4 w-4 opacity-70" />
                    </div>
                </div>
                <div>
                    <p className="text-2xl font-black font-mono tracking-tighter leading-none">
                        {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="text-[10px] ml-1 tracking-normal font-black uppercase opacity-40">{suffix}</span>
                    </p>
                    {subtext && <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-50">{subtext}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

