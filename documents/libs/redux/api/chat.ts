import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { Conversation, Message } from '@/libs/types/chat';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => appendJwtToken(headers),
  }),
  endpoints: (builder) => ({
    getChatResponse: builder.mutation<Message, Conversation>({
      query: (conversation) => ({
        url: `chat/conversation`,
        method: 'POST',
        body: conversation, // Convert conversation to a JSON string
      }),
    }),
  }),
});

export const { useGetChatResponseMutation } = chatApi;
