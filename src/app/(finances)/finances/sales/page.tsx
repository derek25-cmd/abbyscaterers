
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Banknote } from "lucide-react";

export default function SalesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote />
          Sales Book
        </CardTitle>
        <CardDescription>
          This is where all revenue-generating activities like catering orders and event sales will be recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Sales records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
