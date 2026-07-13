import { useState, useEffect, useCallback } from 'react';
import { ToyyibService, ToyyibCategory, ToyyibBillRecord, CreateBillParams, ToyyibBillResponse } from '../services/toyyibService';

// ── useToyyibCategories ────────────────────────────────────────────────────
export interface UseToyyibCategoriesResult {
  categories: ToyyibCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useToyyibCategories(): UseToyyibCategoriesResult {
  const [categories, setCategories] = useState<ToyyibCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ToyyibService.getCategories();
      setCategories(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { categories, loading, error, refresh };
}

// ── useToyyibBills ─────────────────────────────────────────────────────────
export interface UseToyyibBillsResult {
  bills: ToyyibBillRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useToyyibBills(categoryCode?: string): UseToyyibBillsResult {
  const [bills, setBills] = useState<ToyyibBillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await ToyyibService.getBills();
      const filtered = categoryCode ? list.filter(b => b.categoryCode === categoryCode) : list;
      setBills(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [categoryCode]);

  useEffect(() => { refresh(); }, [refresh]);

  return { bills, loading, error, refresh };
}

// ── useCreateBill ──────────────────────────────────────────────────────────
export interface UseCreateBillResult {
  createBill: (params: CreateBillParams) => Promise<ToyyibBillResponse>;
  isCreating: boolean;
  lastBill: ToyyibBillResponse | null;
  reset: () => void;
}

export function useCreateBill(): UseCreateBillResult {
  const [isCreating, setIsCreating] = useState(false);
  const [lastBill, setLastBill] = useState<ToyyibBillResponse | null>(null);

  const createBill = useCallback(async (params: CreateBillParams): Promise<ToyyibBillResponse> => {
    setIsCreating(true);
    try {
      const res = await ToyyibService.createBill(params);
      setLastBill(res);
      return res;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const reset = useCallback(() => setLastBill(null), []);

  return { createBill, isCreating, lastBill, reset };
}
