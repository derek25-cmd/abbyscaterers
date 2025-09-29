
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Users, Loader2 } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { Client } from '@/types';

type CostingFormProps = {
    clients: Client[];
    onSubmit: (request: any) => void;
    isLoading: boolean;
}

export function CostingForm({ clients, onSubmit, isLoading }: CostingFormProps) {
  const [costingType, setCostingType] = useState('aggregate');
  const [clientId, setClientId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState('daily');
  const [dates, setDates] = useState<Date[]>([]);
  
  const handleSubmit = () => {
    if (!periodType || dates.length === 0) {
      alert("Please select a period type and at least one date or month.");
      return;
    }
    if (costingType === 'individual' && !clientId) {
      alert("Please select a client for individual costing.");
      return;
    }

    const formattedDates = dates.map(d => {
      if(periodType === 'daily') return format(d, 'yyyy-MM-dd');
      return format(d, 'yyyy-MM');
    })

    onSubmit({
      type: costingType,
      clientId: costingType === 'individual' ? clientId : null,
      periodType,
      dates: formattedDates
    });
  }

  const handleMonthSelect = (monthDate: Date) => {
    const isSelected = dates.some(d => d.getTime() === monthDate.getTime());
    if (isSelected) {
      setDates(dates.filter(d => d.getTime() !== monthDate.getTime()));
    } else {
      setDates([...dates, monthDate]);
    }
  }
  
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(i);
    return startOfMonth(date);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Aggregate Costing
          </CardTitle>
          <CardDescription>
            Analyze overall profitability across all clients for a selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => setCostingType('aggregate')} className="w-full" variant={costingType === 'aggregate' ? 'default' : 'outline'}>
                Select Aggregate Costing
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            Individual Costing
          </CardTitle>
          <CardDescription>
            Drill down into the costs and profitability for a single client.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={() => setCostingType('individual')} className="w-full" variant={costingType === 'individual' ? 'default' : 'outline'}>
                Select Individual Costing
            </Button>
        </CardContent>
      </Card>

      {costingType && (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Configure Report</CardTitle>
                <CardDescription>Select your parameters for the {costingType} costing report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {costingType === 'individual' && (
                    <div>
                        <Label>Client</Label>
                        <Select onValueChange={setClientId} disabled={isLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div>
                    <Label>Period</Label>
                    <RadioGroup defaultValue="daily" onValueChange={(val) => { setPeriodType(val); setDates([]); }} className="flex gap-4 mt-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="daily" id="daily" />
                            <Label htmlFor="daily">Daily</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="monthly" id="monthly" />
                            <Label htmlFor="monthly">Monthly</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div>
                    {periodType === 'daily' ? (
                        <>
                        <Label>Select Date(s)</Label>
                        <div className="p-2 border rounded-md">
                           <Calendar
                                mode="multiple"
                                selected={dates}
                                onSelect={(d) => setDates(d || [])}
                                footer={<p className="text-center text-sm text-muted-foreground p-2">You selected {dates.length} date(s).</p>}
                           />
                        </div>
                        </>
                    ) : (
                         <>
                        <Label>Select Month(s)</Label>
                        <div className="p-4 border rounded-md grid grid-cols-2 md:grid-cols-4 gap-4">
                           {availableMonths.map((month, i) => (
                               <div key={`${month.toString()}-${i}`} className="flex items-center space-x-2">
                                   <Checkbox
                                        id={month.toString()}
                                        checked={dates.some(d => d.getTime() === month.getTime())}
                                        onCheckedChange={() => handleMonthSelect(month)}
                                   />
                                   <label htmlFor={month.toString()} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                       {format(month, 'MMMM')}
                                   </label>
                               </div>
                           ))}
                        </div>
                         <p className="text-center text-sm text-muted-foreground p-2">
                            You selected {dates.length} month(s): {dates.map(d => format(d, 'MMM')).join(', ')}
                        </p>
                        </>
                    )}
                </div>

                <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Report
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  )
}
