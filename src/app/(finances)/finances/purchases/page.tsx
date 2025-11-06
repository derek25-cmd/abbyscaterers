
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function PurchasesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart />
          Purchases Book
        </CardTitle>
        <CardDescription>
          This is where all goods and services bought (ingredients, consumables, etc.) will be recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Purchase records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
