// User-related events
export interface UserRegisteredEvent {
  eventType: 'USER_REGISTERED';
  userId: string;
  email: string;
  timestamp: string;
}

export const USER_EVENTS = {
  USER_REGISTERED: 'user.registered',
} as const;
