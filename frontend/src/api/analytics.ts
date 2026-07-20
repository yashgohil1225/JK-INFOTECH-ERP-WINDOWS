// =============================================================
// JK INFOTECH ERP — Analytics API
// File : src/api/analytics.ts
// =============================================================

import apiClient from "./client";

export interface KPIs {
  total_sales: number;
  total_receivable: number;
  total_payable: number;
  cash_on_hand: number;
  monthly_growth: number;
  active_customers: number;
}

export interface TrendPoint {
  date: string;
  sales: number;
  purchase: number;
}

export interface LiquidityItem {
  account_name: string;
  balance: number;
  type: "bank" | "cash";
}

export const getKPIs = async (): Promise<KPIs> => {
  const response = await apiClient.get<KPIs>("/api/analytics/kpis");
  return response.data;
};

export const getSalesTrend = async (): Promise<TrendPoint[]> => {
  const response = await apiClient.get<TrendPoint[]>("/api/analytics/sales-trend");
  return response.data;
};

export const getLiquidity = async (): Promise<LiquidityItem[]> => {
  const response = await apiClient.get<LiquidityItem[]>("/api/analytics/liquidity");
  return response.data;
};
