import { IsNotEmpty, IsOptional, IsString, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { RoomType, RoomStatus, RoomCloseReason, ParticipantRole } from './session.enum';

export class OpenOneOnOneRoomDto {
  @IsNotEmpty()
  @IsUUID()
  bookingId: string;
}

export class JoinOneOnOneRoomDto {
  @IsNotEmpty()
  @IsUUID()
  bookingId: string;
}

export class CloseOneOnOneRoomDto {
  @IsNotEmpty()
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsEnum(RoomCloseReason)
  closeReason?: RoomCloseReason;
}

export class CreateGroupRoomDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxParticipants?: number;
}

export class JoinGroupRoomDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;
}

export class LeaveGroupRoomDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;
}

export class GetActiveGroupRoomsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  page?: number;
}

export class MuteParticipantDto {
  @IsNotEmpty()
  @IsUUID()
  participantId: string;

  @IsOptional()
  isMuted?: boolean;
}

export class KickParticipantDto {
  @IsNotEmpty()
  @IsUUID()
  participantId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReportAfkDto {
  @IsNotEmpty()
  @IsUUID()
  participantId: string;
}

export class SendRoomChatMessageDto {
  @IsNotEmpty()
  @IsString()
  content: string;
}

export class StartRecordingDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;
}

export class StopRecordingDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;
}

export interface LiveKitTokenResponse {
  roomId: string;
  roomType: RoomType;
  livekitRoomName: string;
  livekitToken: string;
  livekitWsUrl: string;
  status: RoomStatus;
  role: ParticipantRole;
  bookingId?: string;
  mentorId: string;
  learnerId?: string;
  escrowedCredit?: number;
  availableBalance?: number;
  canJoin: boolean;
  freeSecondsRemaining?: number;
  activeSeconds?: number;
  paidSeconds?: number;
  creditsCharged?: number;
}
