getSessionUsageForUser: builder.query<SessionUsageSummary, string>({
    query: (userId) => `session/usage/byUser/${userId}`,
  }),