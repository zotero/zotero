import type { SessionType } from './sessionType';

export enum MessageStatus {
  UNVIEW = 'UNVIEW',
  DELETED = 'DELETED',
  VIEWED = 'VIEWED',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
}

export enum MessageRole {
  TUTOR = 'TUTOR',
  USER = 'USER',
}

export interface Message {
  id: string | null;
  parentMessageId: string | null;
  userId: string | null;
  sessionId: string;
  subMessages: SubMessage[] | [];
  followUpQuestions: string[] | [];
  creationTime: Date | string | null;
  lastUpdatedTime: Date | string | null;
  status: MessageStatus;
  role: MessageRole;
}

export enum ContentType {
  THINK = 'THINK',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export interface SubMessage {
  text: string | null;
  image: string | null;
  audio: string | null;
  contentType: ContentType;
  creationTime: Date | string | null;
  sources: MessageSource[] | [];
}

export interface MessageSource {
  index: number;
  page: number;
  referenceString: string;
}

export interface Conversation {
  userId: string;
  sessionId: string;
  ragSessionId: string | null;
  storagePaths: string[] | [];
  history: Message[] | [];
  message: Message | null;
  streaming: boolean;
  type: SessionType;
}
