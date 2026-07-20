// =============================================================
// JK INFOTECH ERP — Document Sequences API Client
// File : src/api/sequences.ts
// =============================================================

import apiClient from "./client";

export interface Sequence {
  id: string;
  document_type: string;
  prefix: string | null;
  suffix: string | null;
  next_value: number;
  padding: number;
  is_active: boolean;
}

export interface SequenceUpdate {
  prefix?: string | null;
  suffix?: string | null;
  next_value?: number;
  padding?: number;
  is_active?: boolean;
}

export const sequencesApi = {
  getSequences: async (): Promise<Sequence[]> => {
    const response = await apiClient.get<Sequence[]>("/api/sequences");
    return response.data;
  },

  updateSequence: async (id: string, data: SequenceUpdate): Promise<Sequence> => {
    const response = await apiClient.patch<Sequence>(`/api/sequences/${id}`, data);
    return response.data;
  },

  resetSequences: async (): Promise<Sequence[]> => {
    const response = await apiClient.post<Sequence[]>("/api/sequences/reset");
    return response.data;
  },

  previewSequence: async (documentType: string): Promise<{ next_number: string }> => {
    const response = await apiClient.get<{ next_number: string }>(`/api/sequences/preview/${encodeURIComponent(documentType)}`);
    return response.data;
  },
};
