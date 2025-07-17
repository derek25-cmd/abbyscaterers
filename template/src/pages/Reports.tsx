import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Download } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reports</h2>
          <p className="text-muted-foreground">Analyze your business performance</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Business Analytics</h3>
            <p className="text-muted-foreground mb-4">
              Track performance metrics and generate detailed reports
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">Revenue</Badge>
              <Badge variant="outline">Orders</Badge>
              <Badge variant="outline">Customer Insights</Badge>
              <Badge variant="outline">Trends</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}