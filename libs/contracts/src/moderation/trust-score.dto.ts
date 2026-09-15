export interface TrustScoreResponseDto {
  id: string;
  userId: string;
  score: number;
  mentorScore: number;
  learnerScore: number;
  tier: string;
  mentorTier?: string;
  learnerTier?: string;
  lastUpdatedAt: Date;
}

export interface TrustScoreChangeDto {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  roleType?: 'MENTOR' | 'LEARNER';
  scoreBefore: number;
  scoreAfter: number;
  sourceEventId?: string;
  sourceEventKind?: string;
  occurredAt: Date;
}

export interface TrustScoreHistoryResponseDto {
  trustScore: TrustScoreResponseDto;
  history: TrustScoreChangeDto[];
}

