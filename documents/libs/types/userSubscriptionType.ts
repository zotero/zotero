export enum SubscriptionType {
  BASIC = 'BASIC',
  PLUS = 'PLUS',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionRecurrence {
  MONTHLY = 'P30D',
  ANNUALLY = 'P360D',
}

export interface UserSubscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  type: SubscriptionType;
  startTime: Date | string;
  endTime: Date | string;
  creationTime: Date | string;
  lastUpdatedTime: Date | string;
  recurrence: SubscriptionRecurrence;
}

export interface SubscriptionRegistrationRequest {
  userId: string;
  type: SubscriptionType;
  recurrence: SubscriptionRecurrence;
  startTime: Date;
  endTime: Date;
}

export interface UploadSessionBenefit {
  userId: string;
  numberOfSessionsUploaded: number;
  remainingNumberOfSessionsToUpload: number;
}

export enum SubscriptionUsageEventType {
  NEW_SUBSCRIPTION = 'NEW_SUBSCRIPTION',
  UPLOAD_COURSE = 'UPLOAD_COURSE',
  CANCEL_SUBSCRIPTION = 'CANCEL_SUBSCRIPTION',
  RESET_BENEFIT = 'RESET_BENEFIT',
  RENEW_SUBSCRIPTION = 'RENEW_SUBSCRIPTION',
}

export interface SubscriptionUsageEvent {
  id: string;
  userId: string;
  subscriptionId: string;
  eventType: SubscriptionUsageEventType;
  eventTime: Date | string;
  deltaUsageAmount: number;
  sessionId: string;
}
