
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Landmark } from "lucide-react";

export default function CashBookPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark />
          Cash Book
        </CardTitle>
        <CardDescription>
          This book will record all cash and bank receipts and payments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Cash flow records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
