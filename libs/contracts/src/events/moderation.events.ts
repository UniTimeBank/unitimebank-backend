export const MODERATION_EVENTS = {
  RATING_SUBMITTED: 'moderation.rating_submitted',
  TRUST_SCORE_UPDATED: 'moderation.trust_score_updated',
  REPORT_CREATED: 'moderation.report_created',
  REPORT_RESOLVED: 'moderation.report_resolved',
} as const;

export interface RatingSubmittedEvent {
  ratingId: string;
  bookingId: string;
  learnerId: string;
  mentorId: string;
  stars: number;
  comment?: string;
  submittedAt: Date;
}

export interface TrustScoreUpdatedEvent {
  userId: string;
  score: number;
  delta: number;
  reason: string;
  tier: string;
}

export interface ReportCreatedEvent {
  reportId: string;
  reporterId: string;
  targetUserId: string;
  category: string;
}
