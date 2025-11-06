
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Building } from "lucide-react";

export default function FixedAssetsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building />
          Fixed Assets Register
        </CardTitle>
        <CardDescription>
          This register will keep a record of all company assets like equipment and vehicles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Asset records will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
