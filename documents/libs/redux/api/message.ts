import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { Message } from '@/libs/types/chat';
import type { Session } from '@/libs/types/sessionType';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const messageApi = createApi({
  reducerPath: 'messageApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => appendJwtToken(headers),
    // remove later
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getMessageByMessageId: builder.query<Message, string>({
      query: (messageId) => `message/${messageId}`,
    }),
    getMessagesBySessionId: builder.query<Message[], string>({
      query: (sessionId) => `message/bySession/${sessionId}`,
    }),
    createMessage: builder.mutation<Message, Message>({
      query: (message: Message) => ({
        url: `message/create`,
        method: 'POST',
        body: message,
      }),
    }),
    updateSessionName: builder.mutation<
      Session,
      { sessionId: string; sessionName: string }
    >({
      query: ({ sessionId, sessionName }) => ({
        url: `session/${sessionId}/name`,
        method: 'PUT',
        body: sessionName,
      }),
    }),
  }),
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
  useGetMessageByMessageIdQuery,
  useLazyGetMessagesBySessionIdQuery,
  useCreateMessageMutation,
  useUpdateSessionNameMutation,
} = messageApi;
