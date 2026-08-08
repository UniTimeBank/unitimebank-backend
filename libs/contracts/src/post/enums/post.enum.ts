import { SkillCategoryName } from '../../user/enums';

export { SkillCategoryName };

export enum SessionType {
  ONE_ON_ONE = 'ONE_ON_ONE',
  GROUP = 'GROUP',
  BOTH = 'BOTH',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum LearnerRequestStatus {
  OPEN = 'OPEN',
  MATCHED = 'MATCHED',
  CANCELLED = 'CANCELLED',
}

export enum ModerationDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}
