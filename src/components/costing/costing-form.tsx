
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Users, Loader2, CalendarIcon } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { Client } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { DatePicker } from '../ui/date-picker';

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
  const [month, setMonth] = useState<Date>(new Date());
  
  const handleSubmit = () => {
    const isDaily = periodType === 'daily';
    const selection = isDaily ? dates : (month ? [month] : []);

    if (!periodType || selection.length === 0) {
      alert("Please select a period type and at least one date or month.");
      return;
    }
    if (costingType === 'individual' && !clientId) {
      alert("Please select a client for individual costing.");
      return;
    }

    const formattedDates = selection.map(d => {
      if (isDaily) return format(d, 'yyyy-MM-dd');
      return format(d, 'yyyy-MM');
    })

    onSubmit({
      type: costingType,
      clientId: costingType === 'individual' ? clientId : null,
      periodType,
      dates: formattedDates
    });
  }

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
                    <RadioGroup defaultValue="daily" onValueChange={(val) => { setPeriodType(val); setDates([]); setMonth(new Date()); }} className="flex gap-4 mt-2">
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
                        <div>
                            <Label>Select Month</Label>
                            <div>
                                <DatePicker
                                    selectedDate={month}
                                    onDateChange={setMonth}
                                    labelFormat="MMMM yyyy"
                                    isMonthPicker
                                />
                            </div>
                        </div>
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
