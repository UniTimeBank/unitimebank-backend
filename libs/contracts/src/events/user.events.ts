// User-related events
export interface UserRegisteredEvent {
  eventType: 'USER_REGISTERED';
  userId: string;
  email: string;
  timestamp: string;
}

export interface UserCheckinStreakEvent {
  eventType: 'USER_CHECKIN_STREAK';
  userId: string;
  streakDay: number;
  rewardCredits: number;
  timestamp: string;
}

export const USER_EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_CHECKIN_STREAK: 'user.checkin_streak',
} as const;
