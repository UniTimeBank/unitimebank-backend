export interface CreateNotificationEvent {
  userId: string;
  title: string;
  content: string;
  type?: string;
  referenceId?: string;
  sourceEvent?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export const NOTIFICATION_EVENTS = {
  CREATE: 'notification.create',
  NOTIFICATION_CREATED: 'notification.created',
} as const;
