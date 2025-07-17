import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Download } from "lucide-react";

export default function Invoices() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Invoices</h2>
          <p className="text-muted-foreground">Manage billing and payment tracking</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🧾</div>
            <h3 className="text-xl font-semibold mb-2">Billing & Invoicing</h3>
            <p className="text-muted-foreground mb-4">
              Generate invoices and track payment status
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Pending</Badge>
              <Badge variant="outline">Paid</Badge>
              <Badge variant="outline">Overdue</Badge>
              <Badge variant="outline">Refunded</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}