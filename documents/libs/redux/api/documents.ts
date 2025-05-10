import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type {
  DocumentStatus,
  PresignedUrl,
  TutorDocument,
} from '@/libs/types/DocumentType';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const documentsApi = createApi({
  reducerPath: 'documentApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => appendJwtToken(headers),
    // remove later
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getDocumentsByUserId: builder.query<TutorDocument[], string>({
      query: (userId) => ({
        url: `document/userId/${userId}`,
        method: 'GET',
      }),
    }),
    getDocumentById: builder.query<TutorDocument, string>({
      query: (documentId) => ({
        url: `document/${documentId}`,
        method: 'GET',
      }),
    }),
    deleteDocumentByDocumentId: builder.mutation<TutorDocument, string>({
      query: (documentId) => ({
        url: `document/delete/${documentId}`,
        method: 'DELETE',
      }),
    }),
    getPreSignedAzureBlobUrl: builder.query<
      PresignedUrl,
      { userId: string; filename: string }
    >({
      query: ({ userId, filename }) => ({
        url: `document/preSignedUrl/${userId}/${filename}`,
        method: 'GET',
      }),
    }),
    updateDocumentStatus: builder.mutation<
      TutorDocument,
      { documentId: string; newStatus: DocumentStatus }
    >({
      query: ({ documentId, newStatus }) => ({
        url: `document/update-status/${documentId}`,
        method: 'PATCH',
        body: { status: newStatus },
      }),
    }),
  }),
});

export const {
  useLazyGetDocumentsByUserIdQuery,
  useLazyGetDocumentByIdQuery,
  useDeleteDocumentByDocumentIdMutation,
  useLazyGetPreSignedAzureBlobUrlQuery,
  useUpdateDocumentStatusMutation,
} = documentsApi;
