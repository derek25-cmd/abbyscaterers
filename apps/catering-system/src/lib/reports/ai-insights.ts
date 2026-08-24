// Server-only — never import from a client component. Mirrors
// src/features/marketing/utils/ai.ts's callClaude() exactly: same model,
// same raw-fetch call (no @anthropic-ai/sdk), same timeout handling. This
// file never touches the database — it only turns numbers the caller has
// already computed into a narrative, the same division of labour the
// marketing AI routes use (deterministic numbers in, Claude explains them).

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_TIMEOUT_MS = 45_000;

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 900): Promise<string> {
  let response: Response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      }),
      signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`Claude API timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock) throw new Error('No text in Claude response');
  return textBlock.text;
}

export interface ReportInsightsInput {
  moduleLabel: string;
  periodLabel: string;
  periodType: string;
  kpis: { label: string; value: number; format: string; deltaPct?: number }[];
  highlights?: string[]; // optional extra context, e.g. top suppliers/customers already computed by the caller
}

export interface ReportInsights {
  narrative: string;
  bullets: string[];
  recommendations: string[];
}

function formatKpiLine(k: ReportInsightsInput['kpis'][number]): string {
  const val = k.format === 'currency' ? `TZS ${k.value.toLocaleString()}` : k.format === 'percent' ? `${k.value.toFixed(1)}%` : k.value.toLocaleString();
  const delta = typeof k.deltaPct === 'number' ? ` (${k.deltaPct >= 0 ? '+' : ''}${k.deltaPct.toFixed(1)}% vs previous period)` : '';
  return `- ${k.label}: ${val}${delta}`;
}

/** One JSON-mode Claude call per report module, called from the
 * /api/reports/ai-insights route (never directly from a client component). */
export async function generateReportInsights(input: ReportInsightsInput): Promise<ReportInsights> {
  const system = `You are a business analyst for Abby's Legendary Caterers, a
premium catering company in Dar es Salaam, Tanzania. You are given the
computed figures for one area of the business over a reporting period —
do not recompute or second-guess the numbers, only interpret them. Return a
JSON object only — no markdown, no explanation outside the JSON. The JSON
must have exactly three fields:
"narrative" (3-5 sentences summarising performance, specific with numbers),
"bullets" (an array of 2-4 short strings, each one notable observation),
"recommendations" (an array of 1-3 short strings, each one concrete, actionable step).`;

  const kpiLines = input.kpis.map(formatKpiLine).join('\n');
  const highlightLines = input.highlights?.length ? `\n\nAdditional context:\n${input.highlights.join('\n')}` : '';

  const user = `Module: ${input.moduleLabel}
Period: ${input.periodLabel} (${input.periodType})

Key figures:
${kpiLines}${highlightLines}`;

  const raw = await callClaude(system, user, 700);
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Claude returned a non-JSON response for report insights');
  }
}

export interface ExecutiveSummaryInput {
  periodLabel: string;
  periodType: string;
  moduleSummaries: { moduleLabel: string; kpis: { label: string; value: number; format: string }[] }[];
}

/** One cross-domain narrative tying every module together — the flagship
 * "every single aspect" view. */
export async function generateExecutiveNarrative(input: ExecutiveSummaryInput): Promise<ReportInsights> {
  const system = `You are writing an executive summary for the ownership of
Abby's Legendary Caterers, a premium catering company in Dar es Salaam,
Tanzania, covering every department (finance, HR, inventory, sales,
marketing) for one reporting period. Return a JSON object only — no markdown,
no explanation outside the JSON. The JSON must have exactly three fields:
"narrative" (4-6 sentences, professional English, specific with numbers,
covering the overall health of the business across departments),
"bullets" (an array of 3-6 short strings, each one cross-department
observation or notable trend),
"recommendations" (an array of 2-4 short strings, each one concrete,
actionable step for management).`;

  const sections = input.moduleSummaries
    .map((m) => `${m.moduleLabel}:\n${m.kpis.map((k) => `  - ${k.label}: ${k.format === 'currency' ? 'TZS ' + k.value.toLocaleString() : k.format === 'percent' ? k.value.toFixed(1) + '%' : k.value.toLocaleString()}`).join('\n')}`)
    .join('\n\n');

  const user = `Period: ${input.periodLabel} (${input.periodType})\n\n${sections}`;

  const raw = await callClaude(system, user, 1000);
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Claude returned a non-JSON response for the executive summary');
  }
}

export interface ComparisonInsightsInput {
  moduleLabel: string;
  periodALabel: string;
  periodBLabel: string;
  kpisA: { label: string; value: number; format: string }[];
  kpisB: { label: string; value: number; format: string }[];
}

function formatComparisonValue(k: { value: number; format: string }): string {
  return k.format === 'currency' ? `TZS ${k.value.toLocaleString()}` : k.format === 'percent' ? `${k.value.toFixed(1)}%` : k.value.toLocaleString();
}

/** Narrates a side-by-side comparison of the same module across two
 * different reporting periods — what changed and why it matters. */
export async function generateComparisonInsights(input: ComparisonInsightsInput): Promise<ReportInsights> {
  const system = `You are a business analyst for Abby's Legendary Caterers, a
premium catering company in Dar es Salaam, Tanzania. You are given the same
set of figures for one area of the business across two different reporting
periods, already computed — do not recompute or second-guess the numbers,
only interpret what changed between the two periods. Return a JSON object
only — no markdown, no explanation outside the JSON. The JSON must have
exactly three fields:
"narrative" (3-5 sentences comparing the two periods, specific with numbers
and the direction/magnitude of change),
"bullets" (an array of 2-4 short strings, each one notable change between
the periods),
"recommendations" (an array of 1-3 short strings, each one concrete,
actionable step based on the trend between the two periods).`;

  const lines = input.kpisA
    .map((a, i) => {
      const b = input.kpisB[i];
      if (!b) return null;
      return `- ${a.label}: ${input.periodALabel} = ${formatComparisonValue(a)}, ${input.periodBLabel} = ${formatComparisonValue(b)}`;
    })
    .filter((l): l is string => l !== null)
    .join('\n');

  const user = `Module: ${input.moduleLabel}
Comparing ${input.periodALabel} vs ${input.periodBLabel}

${lines}`;

  const raw = await callClaude(system, user, 700);
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Claude returned a non-JSON response for comparison insights');
  }
}
