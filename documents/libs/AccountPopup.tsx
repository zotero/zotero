import React from 'react';

import EmailIcon from './EmailIcon';
import ManageSubscriptionIcon from './ManageSubscriptionIcon';
import SignOutIcon from './SignOutIcon';
import UsageIcon from './UsageIcon';

export interface AccountPopupProps {
  /** User email to display in the first non-clickable section */
  email: string;
  /** Callback to manage subscription (will redirect to Stripe portal) */
  onManageSubscription: () => void;
  /** Whether the user currently has an active subscription */
  isSubscribed: boolean;
  /** Callback to open upgrade popup when not subscribed */
  onUpgrade: () => void;
  /** Callback to open usage popup */
  onShowUsage: () => void;
  /** Callback to sign out the current user */
  onSignOut: () => void;
  /** Popup placement strategy */
  placement?: 'default' | 'belowRight';
}

/**
 * Account popup with 4 vertically stacked sections:
 * 1) Email row (email icon, email text, check icon) — gray and not clickable
 * 2) Manage Subscription — button row
 * 3) Usage — button row
 * 4) Sign Out — button row
 *
 * Typography: Roboto, size 16, weight 400. Icons left-aligned consistently; text left-aligned.
 */
const AccountPopup: React.FC<AccountPopupProps> = ({
  email,
  onManageSubscription,
  isSubscribed,
  onUpgrade,
  onShowUsage,
  onSignOut,
  placement = 'default',
}) => {
  // Fixed column for leading icons to ensure alignment across rows
  const leadingIconClasses = 'h-5 w-5 shrink-0';

  // Responsive positioning that shifts by 7rem on smaller screens
  const getWrapperPositionClasses = (): string => {
    if (placement === 'belowRight') {
      return 'absolute top-full right-0 mt-2';
    }

    return 'fixed bottom-20 left-8';
  };

  const wrapperPositionClasses = getWrapperPositionClasses();

  return (
    <div
      id="landing-account-popup"
      className={`${wrapperPositionClasses} isolate z-50 w-auto min-w-[14rem] max-w-[24rem] overflow-visible rounded-lg border border-[#BDBDBD] bg-white shadow-[0_4px_8px_rgba(0,0,0,0.08)]`}
    >
      <div className="flex flex-col p-3 pr-4">
        {/* Email (non-clickable) */}
        <div className="flex items-center px-2 py-[0.375rem]">
          <EmailIcon className={leadingIconClasses} />
          <div className="flex grow items-center justify-start">
            <span className="ml-2 truncate font-roboto text-base font-normal text-neutral-500">
              {email}
            </span>
          </div>
        </div>

        {/* Manage Subscription / Upgrade */}
        <button
          type="button"
          className="flex w-full items-center rounded px-2 py-[0.375rem] text-left hover:bg-neutral-100"
          onClick={isSubscribed ? onManageSubscription : onUpgrade}
        >
          <ManageSubscriptionIcon className={leadingIconClasses} />
          <span className="ml-2 font-roboto text-base font-normal text-black">
            {isSubscribed ? 'Manage Subscription' : 'Upgrade'}
          </span>
        </button>

        {/* Usage */}
        <button
          type="button"
          className="mt-1 flex w-full items-center rounded px-2 py-[0.375rem] text-left hover:bg-neutral-100"
          onClick={onShowUsage}
        >
          <UsageIcon className={leadingIconClasses} />
          <span className="ml-2 font-roboto text-base font-normal text-black">
            Usage
          </span>
        </button>

        {/* Sign Out */}
        <button
          type="button"
          className="mt-1 flex w-full items-center rounded px-2 py-[0.375rem] text-left hover:bg-neutral-100"
          onClick={onSignOut}
        >
          <SignOutIcon className={leadingIconClasses} />
          <span className="ml-2 font-roboto text-base font-normal text-black">
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );
};

export default AccountPopup;
