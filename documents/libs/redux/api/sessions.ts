import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type {
  PresignedUrl,
  Session,
  SessionStatus,
} from '@/libs/types/sessionType';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const sessionsApi = createApi({
  reducerPath: 'sessionsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => appendJwtToken(headers),
    // remove later
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getSessionsByUserId: builder.query<Session[], string>({
      query: (userId) => `session/byUser/${userId}`,
    }),
    getSessionBySessionId: builder.query<Session, string>({
      query: (sessionId) => ({
        url: `session/${sessionId}`,
        method: 'GET',
      }),
    }),
    deleteSessionBySessionId: builder.mutation<Session, string>({
      query: (sessionId) => ({
        url: `session/delete/${sessionId}`,
        method: 'DELETE',
      }),
    }),
    getPreSignedUrlBySessionId: builder.query<PresignedUrl, any>({
      query: ({ userId, sessionId, filename }) => ({
        url: `session/presigned-url/${userId}/${sessionId}/${filename}`,
        method: 'GET',
      }),
    }),
    updateSessionStatus: builder.mutation<
      Session,
      { sessionId: string; newStatus: SessionStatus }
    >({
      query: ({ sessionId, newStatus }) => ({
        url: `session/${sessionId}/status`,
        method: 'PUT',
        body: JSON.stringify(newStatus), // Convert newStatus to a JSON string
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),
    createSession: builder.mutation<Session, Session>({
      query: (session: Session) => ({
        url: `session/create`,
        method: 'POST',
        body: session,
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
  useLazyGetSessionsByUserIdQuery,
  useLazyGetSessionBySessionIdQuery,
  useLazyGetPreSignedUrlBySessionIdQuery,
  useUpdateSessionStatusMutation,
  useCreateSessionMutation,
  useUpdateSessionNameMutation,
  useDeleteSessionBySessionIdMutation,
} = sessionsApi;
