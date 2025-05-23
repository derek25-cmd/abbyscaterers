import type { DietaryClassification } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface DietaryAnalysisDisplayProps {
  classifications?: DietaryClassification[];
  rawText?: string;
}

export function DietaryAnalysisDisplay({ classifications, rawText }: DietaryAnalysisDisplayProps) {
  if (!classifications || classifications.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">Dietary Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {rawText && rawText.trim() !== "" ? (
            <p className="text-sm text-muted-foreground">No specific classifications identified from the provided text. Analysis might be pending or the text was too general.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No dietary restrictions provided or analyzed yet.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <CheckCircle2 className="w-6 h-6 mr-2 text-green-500" />
          Dietary Analysis Results
        </CardTitle>
        <CardDescription>
          AI-powered classification of dietary restrictions. Ambiguous items may require clarification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {classifications.map((item, index) => (
            <div key={index} className={`p-3 rounded-md border ${item.isAmbiguous ? 'border-amber-400 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-foreground">{item.restriction}</p>
                  <p className="text-sm text-muted-foreground">
                    Category: <Badge variant={item.isAmbiguous ? "destructive" : "secondary"} className="ml-1">{item.category}</Badge>
                  </p>
                </div>
                {item.isAmbiguous && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-500 shrink-0">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Ambiguous
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
