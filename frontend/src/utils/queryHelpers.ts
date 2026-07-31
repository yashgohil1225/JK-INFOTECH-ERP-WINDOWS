// =============================================================
// JK INFOTECH ERP — Global Query Helpers for Realtime Synchronization
// File : src/utils/queryHelpers.ts
// =============================================================

import { QueryClient } from "@tanstack/react-query";

/**
 * Invalidates all entity and telemetry query caches across the entire app.
 * Call this helper inside onSuccess of any mutation (create, update, delete, payment, transfer)
 * to ensure 100% real-time data consistency across all screens without restarting the app.
 */
export function invalidateAllQueries(queryClient: QueryClient) {
  // 1. Mark all active and background queries stale so they refetch immediately when visited or visible
  queryClient.invalidateQueries();
  queryClient.refetchQueries({ type: "active" });
}

