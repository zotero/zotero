export interface Token {
  id: string;
  title: string;
  lastQuizId: string;
}

export interface TokenBalance {
  id: string;
  userId: string;
  effectiveTime: Date | string;
  tokenCount: number;
  lockedTokenCount: number;
  failureCount: number;
  lastEventType: string;
}
