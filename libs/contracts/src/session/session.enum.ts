export enum RoomType {
  ONE_ON_ONE = 'ONE_ON_ONE',
  GROUP = 'GROUP',
}

export enum RoomStatus {
  SCHEDULED = 'SCHEDULED',
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RoomCloseReason {
  TIME_ELAPSED = 'TIME_ELAPSED',
  HOST_CLOSED = 'HOST_CLOSED',
  LAST_LEARNER_LEFT = 'LAST_LEARNER_LEFT',
  AFK_FORCED_END = 'AFK_FORCED_END',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
}

export enum ParticipantRole {
  MENTOR = 'MENTOR',
  LEARNER = 'LEARNER',
}

export enum ConnectionStatus {
  ONLINE = 'ONLINE',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  KICKED = 'KICKED',
}

export enum AfkSource {
  NO_AUDIO_VIDEO = 'NO_AUDIO_VIDEO',
  GROUP_REPORT = 'GROUP_REPORT',
}

export enum AfkOutcome {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  AUTO_ENDED = 'AUTO_ENDED',
  EXPIRED = 'EXPIRED',
}

export enum RecordingStatus {
  RECORDING = 'RECORDING',
  UPLOADED = 'UPLOADED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export enum HostActionType {
  MUTE = 'MUTE',
  UNMUTE = 'UNMUTE',
  KICK = 'KICK',
  TRANSFER_HOST = 'TRANSFER_HOST',
}

export enum ConnectionEventType {
  JOIN = 'JOIN',
  LEAVE = 'LEAVE',
  DISCONNECT = 'DISCONNECT',
  RECONNECT = 'RECONNECT',
}
