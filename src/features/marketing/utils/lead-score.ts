import type { InterestLevel, Visit } from '../types';

const INTEREST_LEVEL_POINTS: Record<InterestLevel, number> = {
  NOT_INTERESTED: 0,
  MAYBE: 15,
  INTERESTED: 30,
  VERY_INTERESTED: 45,
};

export interface LeadScoreInput {
  interestLevel: InterestLevel | null | undefined;
  decisionMakerMet: boolean;
  budgetConfirmed: boolean;
  followUpRequested: boolean;
  gpsVerified: boolean;
}

export type ScoreTierLabel = 'Cold' | 'Warm' | 'Hot';

export interface ScoreTierMeta {
  label: ScoreTierLabel;
  /** Text color class, e.g. for numbers/labels. */
  color: string;
  /** Small filled-circle class, for dot indicators next to a score. */
  dot: string;
}

export const SCORE_TIER_CONFIG: Record<ScoreTierLabel, ScoreTierMeta> = {
  Cold: { label: 'Cold', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  Warm: { label: 'Warm', color: 'text-warning', dot: 'bg-warning' },
  Hot: { label: 'Hot', color: 'text-destructive', dot: 'bg-destructive' },
};

/**
 * Scores 0-100. Weighting favors signals that correlate with an actual buying
 * decision (decision-maker access, confirmed budget) over soft signals (interest
 * level alone), since marketers tend to over-report interest.
 */
export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 0;

  if (input.interestLevel) {
    score += INTEREST_LEVEL_POINTS[input.interestLevel];
  }
  if (input.decisionMakerMet) score += 20;
  if (input.budgetConfirmed) score += 20;
  if (input.followUpRequested) score += 10;
  if (input.gpsVerified) score += 5;

  return Math.max(0, Math.min(100, score));
}

export function scoreFromVisit(visit: Pick<Visit,
  'interest_level' | 'decision_maker_met' | 'budget_confirmed' | 'follow_up_requested' | 'gps_verified'
>): number {
  return calculateLeadScore({
    interestLevel: visit.interest_level,
    decisionMakerMet: visit.decision_maker_met,
    budgetConfirmed: visit.budget_confirmed,
    followUpRequested: visit.follow_up_requested,
    gpsVerified: visit.gps_verified,
  });
}

export function getTierFromScore(score: number): ScoreTierMeta {
  if (score >= 70) return SCORE_TIER_CONFIG.Hot;
  if (score >= 40) return SCORE_TIER_CONFIG.Warm;
  return SCORE_TIER_CONFIG.Cold;
}
