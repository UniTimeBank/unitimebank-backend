export class CreditRewardEventDto {
  userId: string;
  rewardType: string; // e.g. REGISTER, DAILY_CHECKIN, ONBOARDING
  amount: number;
  sourceEvent?: string;
}

export class BookingAcceptedEventDto {
  bookingId: string;
  learnerId: string;
  amount: number;
}

export class SessionEndedEventDto {
  roomId: string;
  roomType?: string;
  bookingId?: string;
  learnerId: string;
  mentorId: string;
  creditsTransferred: number;
}

export class CreditDeductEventDto {
  roomId: string;
  learnerId: string;
  mentorId: string;
  amount: number; // e.g. 1 credit per minute
}

export class CreditRefundEventDto {
  userId: string;
  amount: number;
  reason: 'TRIAL_REFUND' | 'CANCELLATION_REFUND' | 'AFK_REFUND' | string;
  referenceId?: string;
}
