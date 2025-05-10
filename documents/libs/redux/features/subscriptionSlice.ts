import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type {
  UploadSessionBenefit,
  UserSubscription,
} from '@/libs/types/userSubscriptionType';
import {
  SubscriptionRecurrence,
  SubscriptionType,
} from '@/libs/types/userSubscriptionType';

type SubscriptionState = {
  userSubscription: UserSubscription;
  latestSubscription: UserSubscription;
  craftSessionBenefit: UploadSessionBenefit;
  subscriptionUsageHistory: [string, string, string, number][];
};

const defaultSubscription: UserSubscription = {
  id: '',
  userId: '',
  stripeCustomerId: '',
  stripeSubscriptionId: '',
  type: SubscriptionType.BASIC,
  startTime: '',
  endTime: '',
  creationTime: '',
  lastUpdatedTime: '',
  recurrence: SubscriptionRecurrence.MONTHLY,
};

const defaultCraftSessionBenefit: UploadSessionBenefit = {
  userId: '',
  numberOfSessionsUploaded: 0,
  remainingNumberOfSessionsToUpload: 0,
};

const initialState = {
  userSubscription: defaultSubscription,
  latestSubscription: defaultSubscription,
  craftSessionBenefit: defaultCraftSessionBenefit,
  subscriptionUsageHistory: [],
} as SubscriptionState;

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setSubscription: (state, action: PayloadAction<UserSubscription>) => {
      state.userSubscription = action.payload;
    },
    setLatestSubscription: (state, action: PayloadAction<UserSubscription>) => {
      state.latestSubscription = action.payload;
    },
    setCraftSessionBenefit: (
      state,
      action: PayloadAction<UploadSessionBenefit>,
    ) => {
      state.craftSessionBenefit = action.payload;
    },
    setSubscriptionUsageHistory: (
      state,
      action: PayloadAction<[string, string, string, number][]>,
    ) => {
      state.subscriptionUsageHistory = action.payload;
    },
    removeSubscription: (state) => {
      state.userSubscription = defaultSubscription;
    },
    removeLatestSubscription: (state) => {
      state.latestSubscription = defaultSubscription;
    },
    removeCraftSessionBenefit: (state) => {
      state.craftSessionBenefit = defaultCraftSessionBenefit;
    },
    removeSubscriptionUsageHistory: (state) => {
      state.subscriptionUsageHistory = [];
    },
  },
});

export const {
  setSubscription,
  setLatestSubscription,
  setCraftSessionBenefit,
  setSubscriptionUsageHistory,
  removeSubscription,
  removeLatestSubscription,
  removeCraftSessionBenefit,
  removeSubscriptionUsageHistory,
} = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
