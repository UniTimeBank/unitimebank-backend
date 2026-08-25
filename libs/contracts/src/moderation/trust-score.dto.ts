export interface TrustScoreResponseDto {
  id: string;
  userId: string;
  score: number;
  tier: string;
  lastUpdatedAt: Date;
}

export interface TrustScoreChangeDto {
  id: string;
  userId: string;
  delta: number;
  reason: string;
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
