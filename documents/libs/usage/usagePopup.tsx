import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { useGetSessionUsageForUserQuery } from '@/libs/redux/api/sessions';
import { SubscriptionType } from '@/libs/types/userSubscriptionType';

export interface UsagePopupProps {
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Usage popup displaying session usage statistics for the current user
 * Shows different content based on subscription type (Free, Pro, Premium)
 */
const UsagePopup: React.FC<UsagePopupProps> = ({ onClose, onUpgrade }) => {
  // Get the current user ID and subscription from Redux state
  const backendUser = useSelector((state: any) => state.user.backendUser);
  const activeSubscription = useSelector(
    (state: any) => state.subscription.userSubscription,
  );

  // Fetch session usage data for the current user - always fetch when popup is open
  const {
    data: usageData,
    isLoading,
    error,
    refetch,
  } = useGetSessionUsageForUserQuery(backendUser.id);

  // Refetch data every time the popup opens to ensure it's up to date
  useEffect(() => {
    if (backendUser.id) {
      refetch();
    }
  }, [backendUser.id, refetch]);

  /**
   * Gets the current week's date range (Monday to Sunday)
   * @returns Formatted date range string
   */
  const getCurrentWeekRange = (): string => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
  };

  /**
   * Gets the subscription date range from the active subscription
   * @returns Formatted subscription date range string
   */
  const getSubscriptionDateRange = (): string => {
    if (
      !activeSubscription ||
      !activeSubscription.startTime ||
      !activeSubscription.endTime
    ) {
      return getCurrentWeekRange();
    }

    const startDate = new Date(activeSubscription.startTime);
    const endDate = new Date(activeSubscription.endTime);

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  /**
   * Gets the subscription type display name
   * @returns Formatted subscription type string
   */
  const getSubscriptionTypeDisplay = (): string => {
    if (!activeSubscription || activeSubscription.id === '') {
      return 'DeepTutor Free';
    }

    switch (activeSubscription.type) {
      case SubscriptionType.BASIC:
        return 'DeepTutor Pro';
      case SubscriptionType.PLUS:
        return 'DeepTutor Pro';
      case SubscriptionType.PREMIUM:
        return 'DeepTutor Premium';
      default:
        return 'DeepTutor Free';
    }
  };

  /**
   * Gets the total sessions for the current week
   * Note: LITE = Standard Mode, BASIC = Advanced Mode (new naming convention)
   * @returns Total weekly sessions count
   */
  const getWeeklyTotalSessions = (): number => {
    if (!usageData) return 0;
    return usageData.weeklyLiteCount + usageData.weeklyBasicCount;
  };

  /**
   * Gets the total sessions for the current cycle
   * Note: LITE = Standard Mode, BASIC = Advanced Mode (new naming convention)
   * @returns Total cycle sessions count
   */
  const getCycleTotalSessions = (): number => {
    if (!usageData) return 0;
    return usageData.liteCount + usageData.basicCount;
  };

  /**
   * Renders a progress bar
   * @param current - Current value
   * @param max - Maximum value
   * @param label - Label for the progress bar
   * @param isDisabled - Whether the progress bar should be disabled/grayed out
   * @param useGradient - Whether to use blue-to-cyan gradient instead of solid colors
   * @param showUnlimited - Whether to show "x/unlimited sessions" instead of "x/max sessions"
   * @returns JSX element for the progress bar
   */
  const renderProgressBar = (
    current: number,
    max: number,
    label: string,
    isDisabled: boolean = false,
    useGradient: boolean = false,
    showUnlimited: boolean = false,
  ) => {
    let percentage = 0;
    if (showUnlimited) {
      percentage = 100;
    } else if (max > 0) {
      percentage = Math.min((current / max) * 100, 100);
    }

    let sessionText = '';
    if (isDisabled) {
      sessionText = 'Not available';
    } else if (showUnlimited) {
      sessionText = `${current}/unlimited sessions`;
    } else {
      sessionText = `${current}/${max} sessions`;
    }

    let progressBarColor = '';
    if (isDisabled) {
      progressBarColor = 'bg-gray-400';
    } else if (useGradient) {
      progressBarColor = 'bg-gradient-to-r from-blue-500 to-cyan-400';
    } else if (percentage >= 100) {
      progressBarColor = 'bg-green-500';
    } else {
      progressBarColor = 'bg-blue-500';
    }

    return (
      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm">
          <span
            className={`font-medium ${
              isDisabled ? 'text-gray-500' : 'text-gray-700'
            }`}
          >
            {label}
          </span>
          <span
            className={`font-medium ${
              isDisabled ? 'text-gray-500' : 'text-gray-700'
            }`}
          >
            {sessionText}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${progressBarColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section className="relative flex w-4/5 flex-col rounded-xl bg-white lg:max-w-xl">
        <div className="flex w-full flex-col p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-roboto text-[28px] font-bold leading-7 tracking-wide text-text-black">
              Usage
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close usage popup"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-lg text-gray-600">Loading usage data...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="text-red-800">
                Error loading usage data. Please try again later.
              </div>
            </div>
          )}

          {/* Usage Data Display */}
          {usageData && (
            <div className="space-y-6">
              {/* Subscription Type and Date Range Row */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getSubscriptionTypeDisplay()}
                </h3>
                <div className="text-sm text-gray-600">
                  {!activeSubscription || activeSubscription.id === ''
                    ? getCurrentWeekRange()
                    : getSubscriptionDateRange()}
                </div>
              </div>

              {/* Free Mode Display */}
              {(!activeSubscription || activeSubscription.id === '') && (
                <div className="space-y-4">
                  {/* Standard Mode Progress Bar (LITE sessions) */}
                  {renderProgressBar(
                    getWeeklyTotalSessions(),
                    5,
                    'Standard Mode',
                    false,
                    true,
                  )}

                  {/* Advanced Mode Progress Bar (BASIC sessions - not available for free users) */}
                  {renderProgressBar(0, 0, 'Advanced Mode', true)}

                  {/* Upgrade Message */}
                  <div className="mt-6 text-center">
                    <p className="mb-4 text-gray-700">
                      Need more sessions?{' '}
                      <button
                        type="button"
                        onClick={onUpgrade}
                        className="text-blue-600 underline hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Upgrade Plan
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* Pro Subscription Display */}
              {activeSubscription &&
                activeSubscription.id !== '' &&
                (activeSubscription.type === SubscriptionType.BASIC ||
                  activeSubscription.type === SubscriptionType.PLUS) && (
                  <div className="space-y-4">
                    {/* Standard Mode Display (no progress bar) */}
                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Standard Mode
                        </span>
                        <span className="font-medium text-gray-700">
                          {usageData.liteCount} sessions
                        </span>
                      </div>
                      <div className="h-0.5 bg-gray-200" />
                    </div>

                    {/* Advanced Mode Display (no progress bar) */}
                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Advanced Mode
                        </span>
                        <span className="font-medium text-gray-700">
                          {usageData.basicCount} sessions
                        </span>
                      </div>
                      <div className="h-0.5 bg-gray-200" />
                    </div>

                    {/* Total Sessions Progress Bar */}
                    <div className="mt-6">
                      {renderProgressBar(
                        getCycleTotalSessions(),
                        200,
                        'Total Sessions',
                        false,
                        true,
                      )}
                    </div>

                    {/* Upgrade Message for Pro Users */}
                    <div className="mt-6 text-center">
                      <p className="mb-4 text-gray-700">
                        Need more sessions?{' '}
                        <button
                          type="button"
                          onClick={onUpgrade}
                          className="text-blue-600 underline hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Upgrade Plan
                        </button>
                      </p>
                    </div>
                  </div>
                )}

              {/* Premium Subscription Display */}
              {activeSubscription &&
                activeSubscription.id !== '' &&
                activeSubscription.type === SubscriptionType.PREMIUM && (
                  <div className="space-y-4">
                    {/* Standard Mode Display (no progress bar) */}
                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Standard Mode
                        </span>
                        <span className="font-medium text-gray-700">
                          {usageData.liteCount} sessions
                        </span>
                      </div>
                      <div className="h-0.5 bg-gray-200" />
                    </div>

                    {/* Advanced Mode Display (no progress bar) */}
                    <div className="mb-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-medium text-gray-700">
                          Advanced Mode
                        </span>
                        <span className="font-medium text-gray-700">
                          {usageData.basicCount} sessions
                        </span>
                      </div>
                      <div className="h-0.5 bg-gray-200" />
                    </div>

                    {/* Total Sessions Progress Bar - Same structure as Pro */}
                    <div className="mt-6">
                      {renderProgressBar(
                        getCycleTotalSessions(),
                        200,
                        'Total Sessions',
                        false,
                        true,
                        true, // Show unlimited text for Premium
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* No Data State */}
          {!isLoading && !error && !usageData && (
            <div className="py-8 text-center">
              <div className="text-lg text-gray-600">
                No usage data available
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default UsagePopup;
