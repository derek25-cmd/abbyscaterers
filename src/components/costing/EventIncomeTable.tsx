
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import type { ClientEvent } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";

interface EventIncomeTableProps {
  events: ClientEvent[];
}

const EventIncomeTable = ({ events }: EventIncomeTableProps) => {
  const { getClientById } = useClientStorage();
  const totalIncome = events.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Event Income</span>
          <Badge variant="outline">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Meal Type</TableHead>
              <TableHead>Total Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length > 0 ? events.map((event, index) => {
              const client = getClientById(event.clientId);
              const totalPrice = event.unitPrice * event.numberOfPeople;
              return (
              <TableRow key={index}>
                <TableCell className="font-medium">{client?.companyName || "Unknown Client"}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {event.mealType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className="text-success">
                    {formatCurrency(totalPrice)}
                  </span>
                </TableCell>
              </TableRow>
            )}) : (
              <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">No events scheduled for this date.</TableCell>
              </TableRow>
            )}
            <TableRow className="border-t-2">
              <TableCell colSpan={2} className="font-bold">
                Total Event Income
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-success">
                {formatCurrency(totalIncome)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default EventIncomeTable;
