// All Claude API calls for the marketing module go through this file.
// Uses the Anthropic API at https://api.anthropic.com/v1/messages
// Model: claude-sonnet-4-6
// API key: process.env.ANTHROPIC_API_KEY (server-side only — never import this file from a client component)

const CLAUDE_MODEL = "claude-sonnet-4-6";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 1000): Promise<string> {
  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === "text");
  if (!textBlock) throw new Error("No text in Claude response");
  return textBlock.text;
}

// ── Feature 1: Follow-up message drafter ─────────────────────
export interface FollowUpDraftInput {
  companyName: string;
  contactName?: string;
  contactPosition?: string;
  visitNotes: string;
  visitPurpose: string;
  interestLevel: string;
  servicesPresented: string[];
  followUpType: string; // "CALL" | "EMAIL" | "WHATSAPP"
  language: "english" | "swahili";
}

export async function draftFollowUpMessage(input: FollowUpDraftInput): Promise<string> {
  const system = `You are a professional business development assistant for
Abby's Legendary Caterers, a premium catering company in Dar es Salaam,
Tanzania. You write follow-up messages that are warm, professional, and
persuasive — but never pushy. Always write in the requested language.
For WhatsApp: keep it under 200 words, conversational, no formal headers.
For Email: include a subject line on the first line prefixed with "Subject: ",
then a blank line, then the body. Keep email under 300 words.
For Call script: write talking points as a short numbered list, not a script.
Return ONLY the message text, nothing else.`;

  const user = `Write a ${input.followUpType.toLowerCase()} follow-up message
in ${input.language} for a business visit with the following details:

Company: ${input.companyName}
Contact: ${input.contactName ?? "the contact person"}
  ${input.contactPosition ? `(${input.contactPosition})` : ""}
Visit purpose: ${input.visitPurpose}
Services presented: ${input.servicesPresented.join(", ") || "our catering services"}
Interest level: ${input.interestLevel}
Visit notes: ${input.visitNotes}

The message should reference the visit naturally and include a clear next step.`;

  return callClaude(system, user, 600);
}

// ── Feature 2: Visit summary generator ───────────────────────
export interface VisitSummaryInput {
  companyName: string;
  visitDate: string;
  marketerName: string;
  purpose: string;
  notes: string;
  interestLevel: string;
  decisionMakerMet: boolean;
  budgetConfirmed: boolean;
  servicesPresented: string[];
  outcome: string;
  leadScore: number;
}

export async function generateVisitSummary(input: VisitSummaryInput): Promise<string> {
  const system = `You are a CRM assistant for Abby's Legendary Caterers.
Convert raw visit notes into a clean, professional visit report.
Write in third person. Be concise — 3 to 5 sentences maximum.
Include: what was discussed, the prospect's reaction, and the recommended
next action. Do not invent details not present in the notes.
Return ONLY the summary paragraph, nothing else.`;

  const user = `Generate a visit summary report:

Company: ${input.companyName}
Visit date: ${input.visitDate}
Marketer: ${input.marketerName}
Purpose: ${input.purpose}
Outcome: ${input.outcome}
Interest level: ${input.interestLevel}
Decision maker met: ${input.decisionMakerMet ? "Yes" : "No"}
Budget confirmed: ${input.budgetConfirmed ? "Yes" : "No"}
Services presented: ${input.servicesPresented.join(", ") || "general overview"}
Lead score: ${input.leadScore}/100
Raw notes: ${input.notes}`;

  return callClaude(system, user, 400);
}

// ── Feature 3: Lead analysis and recommendation ───────────────
export interface LeadAnalysisInput {
  companyName: string;
  industry: string;
  employeeCount?: number;
  estimatedValue?: number;
  pipelineStage: string;
  leadScore: number;
  visitCount: number;
  lastVisitDaysAgo: number;
  followUpsCompleted: number;
  followUpsMissed: number;
  visitSummaries: string[]; // last 3 visit notes
}

export interface LeadAnalysisResult {
  recommendation: "PURSUE" | "PAUSE" | "ABANDON";
  reasoning: string;
  nextAction: string;
}

export async function analyseLeadAndRecommend(input: LeadAnalysisInput): Promise<LeadAnalysisResult> {
  const system = `You are a sales strategy advisor for Abby's Legendary
Caterers. Analyse prospect data and return a JSON object only — no markdown,
no explanation outside the JSON. The JSON must have exactly three fields:
"recommendation" (one of: PURSUE, PAUSE, ABANDON),
"reasoning" (2-3 sentences explaining why),
"nextAction" (one specific actionable step, max 20 words).`;

  const user = `Analyse this prospect:

Company: ${input.companyName}
Industry: ${input.industry}
Employees: ${input.employeeCount ?? "unknown"}
Estimated monthly value: TZS ${input.estimatedValue?.toLocaleString() ?? "unknown"}
Current stage: ${input.pipelineStage}
Lead score: ${input.leadScore}/100
Total visits: ${input.visitCount}
Days since last visit: ${input.lastVisitDaysAgo}
Follow-ups completed: ${input.followUpsCompleted}
Follow-ups missed: ${input.followUpsMissed}
Recent visit notes:
${input.visitSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  const raw = await callClaude(system, user, 400);

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      recommendation: "PAUSE",
      reasoning: "Could not parse AI response. Please review manually.",
      nextAction: "Review visit history and decide manually.",
    };
  }
}

// ── Feature 4: Competitor intelligence summary ────────────────
export async function summariseCompetitorIntel(competitorName: string, notes: string): Promise<string> {
  const system = `You are a competitive intelligence analyst for a catering
company in Tanzania. Summarise competitor information in 2 sentences.
Focus on: what they offer, any weaknesses mentioned, and how to position
Abby's Legendary Caterers against them. Return ONLY the summary.`;

  const user = `Competitor: ${competitorName}\nField notes: ${notes}`;
  return callClaude(system, user, 200);
}

// ── Feature 5: Competitive landscape analysis (across all competitors) ──
export interface CompetitorInsightInput {
  name: string;
  companyCount: number;
  totalEstimatedValue: number;
  avgLeadScore: number;
  industries: string[];
}

export async function generateCompetitorInsight(competitors: CompetitorInsightInput[]): Promise<string> {
  const system = `You are a competitive strategy advisor for Abby's Legendary
Caterers in Dar es Salaam, Tanzania. Analyse the competitive landscape data
and write one paragraph (3-4 sentences) identifying which competitor poses
the biggest threat to revenue and a concrete strategic recommendation.
Return ONLY the paragraph.`;

  const user = competitors
    .map((c, i) => `${i + 1}. ${c.name} — ${c.companyCount} clients, TZS ${c.totalEstimatedValue.toLocaleString()} at stake, avg lead score ${c.avgLeadScore}, industries: ${c.industries.join(", ") || "unknown"}`)
    .join("\n");

  return callClaude(system, user, 300);
}

// ── Feature 6: Monthly report narrative ──────────────────────
export interface ReportNarrativeInput {
  month: string;
  totalVisits: number;
  newClients: number;
  revenueGenerated: number;
  topMarketer: string;
  topMarketerRevenue: number;
  topRegion: string;
  conversionRate: number;
  cac: number | null;
  competitorCount: number;
  vsLastMonth: { visits: number; revenue: number };
}

export async function generateMonthlyReportNarrative(input: ReportNarrativeInput): Promise<string> {
  const system = `You are writing a monthly marketing performance summary
for Abby's Legendary Caterers management in Dar es Salaam, Tanzania.
Write in professional English. 3-4 sentences. Be specific with numbers.
Note what went well and what needs attention. End with one recommendation.
Return only the paragraph, nothing else.`;

  const user = `Month: ${input.month}
Total field visits: ${input.totalVisits}
New clients acquired: ${input.newClients}
Revenue from new clients: TZS ${input.revenueGenerated.toLocaleString()}
Top performer: ${input.topMarketer} (TZS ${input.topMarketerRevenue.toLocaleString()})
Best region: ${input.topRegion}
Pipeline conversion rate: ${input.conversionRate.toFixed(1)}%
Customer acquisition cost: ${input.cac ? "TZS " + input.cac.toLocaleString() : "not calculated"}
Active competitors tracked: ${input.competitorCount}
vs last month: visits ${input.vsLastMonth.visits > 0 ? "+" : ""}${input.vsLastMonth.visits}%, revenue ${input.vsLastMonth.revenue > 0 ? "+" : ""}${input.vsLastMonth.revenue}%`;

  return callClaude(system, user, 300);
}
