
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function ExpensesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign />
          Expense Book
        </CardTitle>
        <CardDescription>
          This book will capture all overhead costs like salaries, utilities, and transport.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Expense records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
