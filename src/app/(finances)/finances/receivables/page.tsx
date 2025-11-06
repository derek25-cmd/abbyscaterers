
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BookUser } from "lucide-react";

export default function ReceivablesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookUser />
          Accounts Receivable Ledger
        </CardTitle>
        <CardDescription>
          This ledger will show all amounts owed by your customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Customer balances will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
