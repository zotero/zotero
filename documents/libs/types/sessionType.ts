export enum SessionStatus {
  CREATED = 'CREATED',
  READY = 'READY',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  FINAL_PROCESSING_ERROR = 'FINAL_PROCESSING_ERROR',
  PROCESSING = 'PROCESSING',
  DELETED = 'DELETED',
}

export enum SessionType {
  LITE = 'LITE',
  BASIC = 'BASIC',
  ADVANCED = 'ADVANCED',
}

interface SessionStatusEvent {
  effectiveTime: string;
  status: SessionStatus;
}

export interface PresignedUrl {
  preSignedUrl: string;
  preSignedReadUrl: string;
}

export interface Session {
  id: string | null;
  userId: string;
  sessionName: string | null;
  creationTime: Date | string | null;
  lastUpdatedTime: Date | string | null;
  type: SessionType | null;
  status: SessionStatus | null;
  statusTimeline: SessionStatusEvent[] | [];
  documentIds: string[] | [];
  generateHash: string | null;
}
