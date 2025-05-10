export enum DocumentStatus {
  READY = 'READY',
  STUDYING = 'STUDYING',
  COMPLETE = 'COMPLETED',
  PROCESSING = 'PROCESSING',
  DELETED = 'DELETED',
}

export enum DocumentType {
  DEFAULT = 'DEFAULT',
  ZERO_SHOT = 'ZERO_SHOT',
  USER_UPLOADED = 'USER_UPLOADED',
}

export interface PresignedUrl {
  documentId: string;
  preSignedUrl: string;
  preSignedReadUrl: string;
}

export interface TutorDocument {
  id: string;
  userId: string;
  fileName: string;
  storagePath: string;
  readUrl: string;
  readExpireTime: Date;
  md5: string;
  extractedText: string;
  appendix: string;
  creationTime: Date;
  lastUpdatedTime: Date;
}
