"use client";

import { useState } from "react";
import { ChevronDown, Copy, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCompany, useDraftFollowUp } from "../../hooks/useMarketingQuery";
import { titleCase } from "../../utils/format";

export function FollowUpDrafter({
  companyId,
  followUpType,
  onUseDraft,
}: {
  companyId: string | undefined;
  followUpType: string;
  onUseDraft: (draft: string) => void;
}) {
  const { toast } = useToast();
  const { data: company } = useCompany(companyId);
  const draftFollowUp = useDraftFollowUp();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<"english" | "swahili">("english");
  const [draft, setDraft] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const latestVisit = company?.visits[0];

  const generate = async (lang: "english" | "swahili") => {
    if (!company) return;
    setUnavailable(false);
    try {
      const result = await draftFollowUp.mutateAsync({
        companyName: company.name,
        contactName: company.contact_name ?? undefined,
        contactPosition: company.contact_position ?? undefined,
        visitNotes: latestVisit?.notes ?? "No prior visit notes on file.",
        visitPurpose: latestVisit?.purpose ? titleCase(latestVisit.purpose) : "General introduction",
        interestLevel: latestVisit?.interest_level ? titleCase(latestVisit.interest_level) : "Unknown",
        servicesPresented: latestVisit?.services_presented ?? [],
        followUpType,
        language: lang,
      });
      setDraft(result.draft);
    } catch {
      setUnavailable(true);
    }
  };

  if (!companyId) return null;

  return (
    <Collapsible open={open} onOpenChange={(next) => { setOpen(next); if (next && !draft && !unavailable) generate(language); }}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Draft with AI</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3 rounded-md border p-3">
        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            AI drafting is currently unavailable. You can still write the follow-up manually.
          </p>
        ) : (
          <>
            <Tabs value={language} onValueChange={(v) => { const lang = v as "english" | "swahili"; setLanguage(lang); generate(lang); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger type="button" value="english">English</TabsTrigger>
                <TabsTrigger type="button" value="swahili">Swahili</TabsTrigger>
              </TabsList>
            </Tabs>

            {draftFollowUp.isPending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Drafting message...
              </div>
            ) : (
              <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Generated draft will appear here." />
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={!draft} onClick={() => { onUseDraft(draft); toast({ title: "Draft applied to notes" }); }}>
                Use this draft
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={draftFollowUp.isPending} onClick={() => generate(language)}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!draft}
                onClick={() => { navigator.clipboard.writeText(draft); toast({ title: "Copied to clipboard" }); }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
