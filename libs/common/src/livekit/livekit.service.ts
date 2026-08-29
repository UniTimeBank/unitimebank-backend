import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { ParticipantRole } from '@app/contracts/session';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly wsUrl: string;
  private readonly roomServiceClient: RoomServiceClient;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') || 'APItestkey12345';
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET') || 'SECtestsecret1234567890abcdef';
    this.wsUrl = this.configService.get<string>('LIVEKIT_URL') || 'wss://unitimebank-livekit.livekit.cloud';
    this.roomServiceClient = new RoomServiceClient(
      this.wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
      this.apiKey,
      this.apiSecret,
    );
  }

  async generateToken(params: {
    roomName: string;
    identity: string;
    name?: string;
    role: ParticipantRole;
  }): Promise<{ token: string; wsUrl: string }> {
    const isHost = params.role === ParticipantRole.MENTOR;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.name || params.identity,
      ttl: '4h',
    });

    at.addGrant({
      room: params.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
    });

    const token = await at.toJwt();
    return {
      token,
      wsUrl: this.wsUrl,
    };
  }

  getWsUrl(): string {
    return this.wsUrl;
  }

  async removeParticipant(roomName: string, identity: string): Promise<void> {
    try {
      await this.roomServiceClient.removeParticipant(roomName, identity);
    } catch (error) {
      this.logger.warn(
        `Không thể ngắt participant ${identity} khỏi phòng ${roomName}`,
        error,
      );
    }
  }
}
