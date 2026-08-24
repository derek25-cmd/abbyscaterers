import type { Company, PipelineFunnelStage, PipelineStage } from '../types';

export interface StageMeta {
  stage: PipelineStage;
  label: string;
  /** Tailwind classes using only existing `hsl(var(--token))`-backed colors. */
  color: string;
  order: number;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'IDENTIFIED',
  'VISITED',
  'INTERESTED',
  'QUOTATION_REQUESTED',
  'NEGOTIATING',
  'WON',
  'LOST',
];

/** Stages shown on the main funnel/kanban board — LOST is tracked separately. */
export const FUNNEL_STAGES: PipelineStage[] = PIPELINE_STAGES.filter((stage) => stage !== 'LOST');

export const STAGE_MAP: Record<PipelineStage, StageMeta> = {
  IDENTIFIED: { stage: 'IDENTIFIED', label: 'Identified', color: 'bg-muted text-muted-foreground', order: 0 },
  VISITED: { stage: 'VISITED', label: 'Visited', color: 'bg-secondary text-secondary-foreground', order: 1 },
  INTERESTED: { stage: 'INTERESTED', label: 'Interested', color: 'bg-primary/10 text-primary', order: 2 },
  QUOTATION_REQUESTED: { stage: 'QUOTATION_REQUESTED', label: 'Quotation Requested', color: 'bg-warning/15 text-warning', order: 3 },
  NEGOTIATING: { stage: 'NEGOTIATING', label: 'Negotiating', color: 'bg-warning/25 text-warning', order: 4 },
  WON: { stage: 'WON', label: 'Won', color: 'bg-success/15 text-success', order: 5 },
  LOST: { stage: 'LOST', label: 'Lost', color: 'bg-destructive/10 text-destructive', order: 6 },
};

/** Forward-moving pipeline graph. LOST can be reopened back to IDENTIFIED; WON is terminal. */
export const VALID_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  IDENTIFIED: ['VISITED', 'LOST'],
  VISITED: ['INTERESTED', 'LOST'],
  INTERESTED: ['QUOTATION_REQUESTED', 'LOST'],
  QUOTATION_REQUESTED: ['NEGOTIATING', 'LOST'],
  NEGOTIATING: ['WON', 'LOST'],
  WON: [],
  LOST: ['IDENTIFIED'],
};

export function getStageMeta(stage: PipelineStage): StageMeta {
  return STAGE_MAP[stage];
}

/** CSS variable backing each stage's marker colour — resolved at runtime, never hardcoded hex. */
export const STAGE_COLOR_VAR: Record<PipelineStage, string> = {
  IDENTIFIED: '--muted-foreground',
  VISITED: '--secondary-foreground',
  INTERESTED: '--primary',
  QUOTATION_REQUESTED: '--warning',
  NEGOTIATING: '--warning',
  WON: '--success',
  LOST: '--destructive',
};

/** Resolves a `--token` CSS variable (defined as an HSL triplet, e.g. "43 74% 49%") to an `hsl(...)` string Mapbox GL can render. Browser-only — falls back to a neutral grey during SSR. */
export function resolveStageMapColor(stage: PipelineStage): string {
  if (typeof document === 'undefined') return 'hsl(0 0% 60%)';
  const value = getComputedStyle(document.documentElement).getPropertyValue(STAGE_COLOR_VAR[stage]).trim();
  return value ? `hsl(${value})` : 'hsl(0 0% 60%)';
}

export function canTransitionTo(current: PipelineStage, next: PipelineStage): boolean {
  if (current === next) return false;
  return VALID_TRANSITIONS[current].includes(next);
}

export function buildPipelineFunnel(companies: Pick<Company, 'pipeline_stage'>[]): PipelineFunnelStage[] {
  const counts = new Map<PipelineStage, number>();
  for (const stage of PIPELINE_STAGES) counts.set(stage, 0);

  for (const company of companies) {
    counts.set(company.pipeline_stage, (counts.get(company.pipeline_stage) ?? 0) + 1);
  }

  return FUNNEL_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}
