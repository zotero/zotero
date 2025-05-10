export enum UserStatus {
  'Active',
  'Inactive',
  'Deleted',
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  profilePictureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  provider: string;
  providerUserId: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  profilePictureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  provider: string;
  providerUserId: string;
}

export interface WaitlistUser {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UserInfo {
  username: string;
  email: string;
  email_verified: boolean;
  sub: string;
}
