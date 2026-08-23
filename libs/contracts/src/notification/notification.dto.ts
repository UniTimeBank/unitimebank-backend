export interface NotificationItemDto {
  id: string;
  recipientId: string;
  isRead: boolean;
  readAt?: Date | string | null;
  createdAt: Date | string;
  notification: {
    id: string;
    kind: string;
    title: string;
    body: string;
    sourceEvent?: string;
    payloadRef?: string;
    avatarUrl?: string | null;
    createdAt: Date | string;
  };
}

export interface GetMyNotificationsQueryDto {
  limit?: number;
  unreadOnly?: boolean;
}

export interface GetMyNotificationsResponseDto {
  items: NotificationItemDto[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}
