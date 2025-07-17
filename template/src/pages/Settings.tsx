import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Save } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Configure your application preferences</p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90 shadow-elegant">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold mb-2">Application Settings</h3>
            <p className="text-muted-foreground mb-4">
              Customize your catering management system
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline">General</Badge>
              <Badge variant="outline">Notifications</Badge>
              <Badge variant="outline">Security</Badge>
              <Badge variant="outline">Integrations</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}