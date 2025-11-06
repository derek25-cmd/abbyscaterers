
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BookUp } from "lucide-react";

export default function PayablesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookUp />
          Accounts Payable Ledger
        </CardTitle>
        <CardDescription>
          This ledger will track all amounts your company owes to suppliers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Supplier balances will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
