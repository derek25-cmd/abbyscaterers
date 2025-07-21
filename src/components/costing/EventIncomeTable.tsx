import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Event {
  id: number;
  event_name: string;
  client_name: string;
  event_date: Date;
  amount_paid: number;
}

interface EventIncomeTableProps {
  events: Event[];
}

const EventIncomeTable = ({ events }: EventIncomeTableProps) => {
  const totalIncome = events.reduce((sum, event) => sum + event.amount_paid, 0);

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
              <TableHead>Event Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Income</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.event_name}</TableCell>
                <TableCell>{event.client_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {format(event.event_date, "MMM dd, yyyy")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <span className="text-success">
                    ${event.amount_paid.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={3} className="font-bold">
                Total Event Income
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-success">
                ${totalIncome.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default EventIncomeTable;
