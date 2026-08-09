import { SkillCategoryName } from '../../user/enums';

export { SkillCategoryName };

export enum SessionType {
  ONE_ON_ONE = 'ONE_ON_ONE',
  GROUP = 'GROUP',
  BOTH = 'BOTH',
}

export enum PostScheduleType {
  ALWAYS_OPEN = 'ALWAYS_OPEN',       // Dạy kèm thường xuyên (Luôn mở theo tuần)
  LIMITED_TIME = 'LIMITED_TIME',     // Lớp học / Ôn thi cấp tốc (Có thời hạn startDate - endDate)
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
  EXPIRED = 'EXPIRED',
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
