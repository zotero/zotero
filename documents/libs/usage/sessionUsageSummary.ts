/**
 * SessionUsageSummary interface representing usage statistics for a user's subscription
 * Tracks both cycle-based and weekly usage counts for different session types
 */
export interface SessionUsageSummary {
  /** User identifier */
  userId: string;

  /** Subscription identifier */
  subscriptionId: string | null;

  /** Start of the billing cycle */
  cycleStart: Date | string | null;

  /** End of the billing cycle */
  cycleEnd: Date | string | null;

  /** Total count of LITE sessions in the current cycle */
  liteCount: number;

  /** Total count of BASIC sessions in the current cycle */
  basicCount: number;

  /** Total count of ADVANCED sessions in the current cycle */
  advancedCount: number;

  /** Start of the current week */
  weekStart: Date | string | null;

  /** End of the current week */
  weekEnd: Date | string | null;

  /** Count of LITE sessions in the current week */
  weeklyLiteCount: number;

  /** Count of BASIC sessions in the current week */
  weeklyBasicCount: number;

  /** Count of ADVANCED sessions in the current week */
  weeklyAdvancedCount: number;
}

/**
 * Creates an empty SessionUsageSummary for a given user
 * @param userId - The user identifier
 * @returns A SessionUsageSummary with zero counts and null dates
 */
export const createEmptySessionUsageSummary = (
  userId: string,
): SessionUsageSummary => {
  return {
    userId,
    subscriptionId: null,
    cycleStart: null,
    cycleEnd: null,
    liteCount: 0,
    basicCount: 0,
    advancedCount: 0,
    weekStart: null,
    weekEnd: null,
    weeklyLiteCount: 0,
    weeklyBasicCount: 0,
    weeklyAdvancedCount: 0,
  };
};
