import { SessionType, SkillCategoryName, ModerationDecision } from '../post/enums';

export interface PostCreatedEvent {
  postId: string;
  mentorId: string;
  mentorName: string;
  mentorAvatar?: string;
  title: string;
  sessionType: SessionType;
  tags: Array<{ skillName: string; category?: SkillCategoryName }>;
  createdAt: string;
}

export interface PostModeratedEvent {
  postId: string;
  postType: 'MENTOR_POST' | 'LEARNER_REQUEST';
  decision: ModerationDecision | 'APPROVE' | 'WARN' | 'REMOVE';
  reason?: string;
  moderatorId: string;
  decidedAt: string;
}

export interface UserProfileUpdatedEvent {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  trustScore?: number;
}

export const POST_EVENTS = {
  POST_CREATED: 'post.created',
  POST_UPDATED: 'post.updated',
  POST_CLOSED: 'post.closed',
  POST_MODERATED: 'post.moderated',
  USER_PROFILE_UPDATED: 'user.profile.updated',
  USER_TRUST_SCORE_UPDATED: 'user.trust_score.updated',
} as const;
