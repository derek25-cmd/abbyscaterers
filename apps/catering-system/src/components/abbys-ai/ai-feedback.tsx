"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendAiFeedback } from "@/services/abbysAiService";

/** "Was this useful?" thumbs up / down, with an optional comment (ai_feedback). */
export function AiFeedback({ tool, input, output, modelRun }: {
  tool: "quote" | "menu" | "cost";
  input: unknown;
  output: unknown;
  modelRun?: string | null;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const send = async () => {
    if (rating === null) return;
    setSaving(true);
    const ok = await sendAiFeedback({ tool, rating, comment, input, output, modelRun });
    setSaving(false);
    if (ok) {
      setSent(true);
      toast({ title: "Thank you", description: "Your feedback helps train Abby's AI." });
    } else {
      toast({ variant: "destructive", title: "Not saved", description: "Could not save your feedback." });
    }
  };

  if (sent) {
    return <p className="text-xs text-muted-foreground">Feedback saved. Thank you.</p>;
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Was this useful?</span>
        <Button type="button" size="sm" variant={rating === 1 ? "default" : "outline"} onClick={() => setRating(1)} aria-label="Useful">
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant={rating === -1 ? "destructive" : "outline"} onClick={() => setRating(-1)} aria-label="Not useful">
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
      {rating !== null && (
        <div className="space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={rating === 1 ? "What was right? (optional)" : "What was wrong, and what would you expect? (optional)"}
            className="min-h-[60px] text-sm"
          />
          <Button type="button" size="sm" onClick={send} disabled={saving}>Send feedback</Button>
        </div>
      )}
    </div>
  );
}
