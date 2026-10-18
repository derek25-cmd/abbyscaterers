'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calculator, Check, CheckCircle2, ChevronsUpDown, Info, Loader2, Plus, Sparkles, Trash2, UtensilsCrossed, BadgeDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useStaffRole } from '@/hooks/use-staff-role';
import { useClientStorage } from '@/hooks/use-client-storage';
import { cn } from '@/lib/utils';
import { MEAL_TYPES } from '@/types';
import {
  COST_ROLES,
  estimateMenuCost,
  sourceLabel,
  verdictText,
  type DishCost,
  type MenuIdea,
  type QuoteCheckResult,
} from '@/lib/abbys-ai';
import { checkQuote, getCurrentModelRun, getDishCosts, getMenuIdeas } from '@/services/abbysAiService';
import { AiFeedback } from '@/components/abbys-ai/ai-feedback';

const tzs = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `TZS ${Math.round(n).toLocaleString()}`);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`);
const num = (s: string) => {
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

type CostDish = { dish: string; section: string | null };

export function AbbysAiPageComponent() {
  const { role, isActiveStaff, isLoading: roleLoading } = useStaffRole();
  const canSeeCosts = !!role && (COST_ROLES as readonly string[]).includes(role);
  const [tab, setTab] = useState('quote');
  const [modelRun, setModelRun] = useState<string | null>(null);
  const [costDishes, setCostDishes] = useState<CostDish[]>([]);
  const [costContext, setCostContext] = useState<{ price: string; pax: string }>({ price: '', pax: '' });

  useEffect(() => {
    if (isActiveStaff) getCurrentModelRun().then(r => setModelRun(r?.run ?? null));
  }, [isActiveStaff]);

  if (roleLoading) {
    return <main className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }
  if (!isActiveStaff) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-8">
        <Card><CardHeader><CardTitle>Access restricted</CardTitle><CardDescription>Abby&apos;s AI is for active staff.</CardDescription></CardHeader></Card>
      </main>
    );
  }

  const sendToCost = (dishes: CostDish[], price: string, pax: string) => {
    setCostDishes(dishes);
    setCostContext({ price, pax });
    setTab('cost');
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Abby&apos;s AI
            <Badge variant="secondary" className="uppercase tracking-wide">Beta</Badge>
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Suggestions learned from past orders, menus and Stock Out. They are a second opinion, not a rule:
            please rate each answer so the models can improve.
          </p>
        </div>
        {modelRun && <Badge variant="outline" className="font-mono text-xs">model {modelRun}</Badge>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="quote"><BadgeDollarSign className="mr-1.5 h-4 w-4" /> Quote check</TabsTrigger>
          <TabsTrigger value="menu"><UtensilsCrossed className="mr-1.5 h-4 w-4" /> Menu ideas</TabsTrigger>
          {canSeeCosts && <TabsTrigger value="cost"><Calculator className="mr-1.5 h-4 w-4" /> Cost estimate</TabsTrigger>}
        </TabsList>
        <TabsContent value="quote"><QuoteCheckTab modelRun={modelRun} /></TabsContent>
        <TabsContent value="menu"><MenuIdeasTab modelRun={modelRun} canSeeCosts={canSeeCosts} onEstimate={sendToCost} /></TabsContent>
        {canSeeCosts && (
          <TabsContent value="cost">
            <CostTab modelRun={modelRun} dishes={costDishes} setDishes={setCostDishes} context={costContext} setContext={setCostContext} />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}

// ── Quote check ──────────────────────────────────────────────────────────────

function QuoteCheckTab({ modelRun }: { modelRun: string | null }) {
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const [clientId, setClientId] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const [mealType, setMealType] = useState<string>('Lunch only');
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<QuoteCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const client = clients.find(c => c.id === clientId);

  const run = async () => {
    if (!clientId) {
      toast({ variant: 'destructive', title: 'Pick a client' });
      return;
    }
    setLoading(true);
    try {
      setResult(await checkQuote(clientId, mealType, num(price)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Quote check failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const v = result ? verdictText(result) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check a price</CardTitle>
          <CardDescription>Compares a price per plate with what this client usually pays for the same meal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className={cn('w-full justify-between', !client && 'text-muted-foreground')} disabled={clientsLoading}>
                  <span className="truncate">{clientsLoading ? 'Loading…' : client ? `${client.companyName} (${client.id})` : 'Search client'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Client name or number…" />
                  <CommandList>
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map(c => (
                        <CommandItem key={c.id} value={`${c.companyName} ${c.id}`} onSelect={() => { setClientId(c.id); setClientOpen(false); setResult(null); }}>
                          <Check className={cn('mr-2 h-4 w-4', clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="flex-1 truncate">{c.companyName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.id}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <MealTypeSelect value={mealType} onChange={(m) => { setMealType(m); setResult(null); }} />
          <div className="space-y-1.5">
            <Label htmlFor="quote-price">Price per plate (TZS, as quoted)</Label>
            <Input id="quote-price" inputMode="numeric" placeholder="e.g. 12000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Check
          </Button>
        </CardContent>
      </Card>

      {result && v && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expected: {tzs(result.expected_price)} <span className="text-sm font-normal text-muted-foreground">({result.expected_band})</span></CardTitle>
            <CardDescription>Based on {sourceLabel(result.expected_from, result.meal)}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.price !== null && (
              <div className={cn('flex items-start gap-3 rounded-lg border p-3',
                v.tone === 'warn' && 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
                v.tone === 'ok' && 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30')}>
                {v.tone === 'warn' ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" /> : v.tone === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <Info className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div>
                  <p className="font-semibold">{tzs(result.price)}: {v.title}</p>
                  {v.detail && <p className="text-sm text-muted-foreground">{v.detail}</p>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Client events" value={String(result.client_events)} />
              <Stat label={`Same meal (${result.meal})`} value={result.same_meal ? `${result.same_meal.events} events` : 'none'} />
              <Stat label="Usual / range" value={result.same_meal ? `${Math.round(result.same_meal.median_price).toLocaleString()} (${Math.round(result.same_meal.min_price).toLocaleString()}–${Math.round(result.same_meal.max_price).toLocaleString()})` : '—'} />
              <Stat label="Market median" value={tzs(result.market_median)} />
            </div>
            {result.recent.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Latest events for this client</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Event</TableHead><TableHead>Meal</TableHead><TableHead className="text-right">Pax</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {result.recent.map(r => (
                      <TableRow key={r.event_id}>
                        <TableCell className="text-xs">{r.event_date}</TableCell>
                        <TableCell className="text-xs"><Link className="text-primary hover:underline" href={`/orders/${encodeURIComponent(r.order_id)}`}>{r.event_id}</Link></TableCell>
                        <TableCell className="text-xs">{r.meal_type || '—'}</TableCell>
                        <TableCell className="text-xs text-right">{r.pax}</TableCell>
                        <TableCell className="text-xs text-right">{Math.round(r.unit_price).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <AiFeedback key={`${clientId}-${mealType}-${price}`} tool="quote" modelRun={modelRun}
              input={{ client_id: clientId, meal_type: mealType, price: num(price) }}
              output={{ expected_price: result.expected_price, expected_from: result.expected_from, verdict: result.verdict, diff_pct: result.diff_pct }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Menu ideas ───────────────────────────────────────────────────────────────

function MenuIdeasTab({ modelRun, canSeeCosts, onEstimate }: {
  modelRun: string | null;
  canSeeCosts: boolean;
  onEstimate: (dishes: CostDish[], price: string, pax: string) => void;
}) {
  const { toast } = useToast();
  const [mealType, setMealType] = useState<string>('Lunch only');
  const [price, setPrice] = useState('');
  const [pax, setPax] = useState('');
  const [ideas, setIdeas] = useState<MenuIdea[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const rows = await getMenuIdeas(mealType, num(price), 10);
      setIdeas(rows);
      setPicked(new Set(rows.filter(r => r.score >= 0.4).map(r => `${r.section}|${r.dish_key}`)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Menu ideas failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const sections = useMemo(() => Array.from(new Set((ideas || []).map(i => i.section))), [ideas]);
  const toggle = (k: string) => setPicked(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suggest a menu</CardTitle>
          <CardDescription>The dishes served most often for this meal, weighted toward events at the same price.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MealTypeSelect value={mealType} onChange={setMealType} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="menu-price">Price per plate</Label>
              <Input id="menu-price" inputMode="numeric" placeholder="e.g. 12000" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-pax">Guests</Label>
              <Input id="menu-pax" inputMode="numeric" placeholder="e.g. 60" value={pax} onChange={(e) => setPax(e.target.value)} />
            </div>
          </div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Suggest dishes
          </Button>
        </CardContent>
      </Card>

      {ideas && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suggested dishes</CardTitle>
            <CardDescription>
              &quot;Served at&quot; = share of past {mealType.toLowerCase()} events with this dish{num(price) ? ' (at this price band, where there are enough events)' : ''}. Tick the dishes you would serve.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {ideas.length === 0 && <p className="text-sm text-muted-foreground">No menus recorded yet for this meal.</p>}
            {sections.map(section => (
              <div key={section} className="space-y-2">
                <p className="text-sm font-semibold">{section}</p>
                <div className="space-y-1.5">
                  {ideas.filter(i => i.section === section).map(i => {
                    const k = `${i.section}|${i.dish_key}`;
                    const share = i.band_share ?? i.share;
                    return (
                      <label key={k} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                        <span className="flex-1 text-sm">{i.recipe_name || i.dish_key}{i.recipe_id && <span className="ml-2 text-[10px] text-muted-foreground font-mono">{i.recipe_id}</span>}</span>
                        <div className="w-28 h-2 rounded bg-muted overflow-hidden" aria-hidden><div className="h-full bg-primary/70" style={{ width: `${Math.round(share * 100)}%` }} /></div>
                        <span className="w-20 text-right text-xs text-muted-foreground">served at {pct(share)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {ideas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {canSeeCosts && (
                  <Button variant="outline" onClick={() => onEstimate(
                    ideas.filter(i => picked.has(`${i.section}|${i.dish_key}`)).map(i => ({ dish: i.dish_key, section: i.section })), price, pax)}
                    disabled={picked.size === 0}>
                    <Calculator className="mr-2 h-4 w-4" /> Estimate cost of the ticked dishes
                  </Button>
                )}
              </div>
            )}
            <AiFeedback key={`${mealType}-${price}`} tool="menu" modelRun={modelRun}
              input={{ meal_type: mealType, price: num(price), pax: num(pax) }}
              output={{ suggested: ideas.map(i => `${i.section}: ${i.dish_key}`), picked: Array.from(picked) }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Cost estimate ────────────────────────────────────────────────────────────

function CostTab({ modelRun, dishes, setDishes, context, setContext }: {
  modelRun: string | null;
  dishes: CostDish[];
  setDishes: (d: CostDish[]) => void;
  context: { price: string; pax: string };
  setContext: (c: { price: string; pax: string }) => void;
}) {
  const [costs, setCosts] = useState<DishCost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vatInclusive, setVatInclusive] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    getDishCosts().then(setCosts).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const costMap = useMemo(() => new Map((costs || []).map(c => [c.dish_key, c])), [costs]);
  const est = useMemo(() => estimateMenuCost(dishes, costMap, num(context.price), num(context.pax), vatInclusive),
    [dishes, costMap, context, vatInclusive]);
  const addable = (costs || []).filter(c => !c.dish_key.startsWith('other ') && !dishes.some(d => d.dish === c.dish_key));

  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>;
  if (!costs) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (costs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No cost model is published yet (scripts/db/publish-ai-model.sh).</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estimate food cost</CardTitle>
          <CardDescription>Ingredient cost per plate learned from daily Stock Out against the menus served (Dar es Salaam).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost-price">Price per plate</Label>
              <Input id="cost-price" inputMode="numeric" placeholder="e.g. 12000" value={context.price} onChange={(e) => setContext({ ...context, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-pax">Guests</Label>
              <Input id="cost-pax" inputMode="numeric" placeholder="e.g. 60" value={context.pax} onChange={(e) => setContext({ ...context, pax: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="vat-incl" className="text-sm">Price includes VAT (18%)</Label>
            <Switch id="vat-incl" checked={vatInclusive} onCheckedChange={setVatInclusive} />
          </div>
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add a dish</Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Search dishes…" />
                <CommandList>
                  <CommandEmpty>No dish with a learned cost.</CommandEmpty>
                  <CommandGroup>
                    {addable.map(c => (
                      <CommandItem key={c.dish_key} value={c.dish_key} onSelect={() => { setDishes([...dishes, { dish: c.dish_key, section: c.meal_section }]); setAddOpen(false); }}>
                        <span className="flex-1">{c.dish_key}</span>
                        <span className="text-xs text-muted-foreground">{c.meal_section}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">Tip: pick dishes in Menu ideas and press &quot;Estimate cost&quot;.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estimated cost: {tzs(est.costPerPlate)} per plate</CardTitle>
          <CardDescription>
            {est.priceExVat !== null
              ? <>Food cost {est.foodCostPct}% of {tzs(est.priceExVat)} ex VAT · margin {tzs(est.marginPerPlate)} per plate{est.totalMargin !== null && <> · {tzs(est.totalMargin)} for {num(context.pax)} guests</>}</>
              : 'Enter a price to see the margin.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dishes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add dishes to estimate.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Dish</TableHead><TableHead>Section</TableHead><TableHead className="text-right">Cost per plate</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {est.lines.map((l, i) => (
                  <TableRow key={`${l.dish}-${i}`}>
                    <TableCell className="text-sm">{l.dish}{l.pooled && <Badge variant="outline" className="ml-2 text-[10px]">section average</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.section || '—'}</TableCell>
                    <TableCell className="text-right text-sm">{l.cost === null ? 'unknown' : Math.round(l.cost).toLocaleString()}</TableCell>
                    <TableCell className="w-10">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDishes(dishes.filter((_, j) => j !== i))} aria-label={`Remove ${l.dish}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground">
            An estimate from daily totals: dishes always served together share their cost, and dishes the model has no own figure for use their section&apos;s average.
            {est.unknownDishes.length > 0 && ` No figure at all for: ${est.unknownDishes.join(', ')}.`}
          </p>
          {dishes.length > 0 && (
            <AiFeedback key={dishes.map(d => d.dish).join('|') + context.price} tool="cost" modelRun={modelRun}
              input={{ dishes: dishes.map(d => d.dish), price: num(context.price), pax: num(context.pax), vat_inclusive: vatInclusive }}
              output={{ cost_per_plate: est.costPerPlate, food_cost_pct: est.foodCostPct, margin_per_plate: est.marginPerPlate }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function MealTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Meal</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {MEAL_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
