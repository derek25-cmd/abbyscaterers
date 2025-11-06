
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function TaxBookPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText />
          Tax Book
        </CardTitle>
        <CardDescription>
          This book will track all tax obligations (VAT, PAYE, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Tax records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
