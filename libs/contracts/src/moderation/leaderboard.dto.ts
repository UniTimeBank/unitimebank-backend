export interface MentorLeaderboardItemDto {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  headline?: string;
  mentorTrustScore: number;
  averageRating: number;
  totalReviews: number;
  totalTeachingMinutes: number;
  totalStudentsTaught: number;
  fiveStarReviewsCount: number;
  rankScore: number;
  badgeTitle?: string;
}

export interface LearnerLeaderboardItemDto {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  headline?: string;
  learnerTrustScore: number;
  totalLearningMinutes: number;
  totalSessionsCompleted: number;
  skillsLearnedCount: number;
  reviewsSubmittedCount: number;
  rankScore: number;
  badgeTitle?: string;
}

export interface LeaderboardResponseDto<T> {
  timeframe: 'weekly' | 'monthly' | 'all';
  items: T[];
  total: number;
}
