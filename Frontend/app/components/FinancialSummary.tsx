'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchCashflow,
  fetchExpenseBreakdown,
  fetchFinancialSummary,
  fetchTaxSummary,
  type CashflowPoint,
  type ExpenseCategoryResponse,
  type FinancialSummaryResponse,
  type TaxSummaryResponse,
} from '../../lib/api';

const sourceOptions = [
  { label: 'All Sources', value: 'all' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Telegram', value: 'telegram' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

interface FinancialSummaryProps {
  selectedSource?: 'all' | 'whatsapp' | 'telegram';
  onSourceChange?: (value: 'all' | 'whatsapp' | 'telegram') => void;
  compact?: boolean;
}

export default function FinancialSummary({ selectedSource, onSourceChange, compact = false }: FinancialSummaryProps) {
  const [internalSource, setInternalSource] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const source = selectedSource ?? internalSource;
  const [summary, setSummary] = useState<FinancialSummaryResponse | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryResponse | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryResponse | null>(null);
  const [cashflow, setCashflow] = useState<CashflowPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFinancialData = async () => {
      setLoading(true);
      setError(null);

      try {
        const sourceParam = source === 'all' ? undefined : source;
        const [summaryResponse, categoriesResponse, taxResponse, cashflowResponse] = await Promise.all([
          fetchFinancialSummary(undefined, sourceParam),
          fetchExpenseBreakdown(undefined, sourceParam),
          fetchTaxSummary(undefined, 'month', sourceParam),
          fetchCashflow(undefined, sourceParam),
        ]);

        if (!isMounted) return;

        setSummary(summaryResponse);
        setCategories(categoriesResponse);
        setTaxSummary(taxResponse);
        setCashflow(cashflowResponse.timeline);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load financial summary');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    loadFinancialData();
    return () => {
      isMounted = false;
    };
  }, [source]);

  const chartValues = useMemo(() => {
    if (!cashflow || cashflow.length === 0) return [];
    const maxValue = Math.max(...cashflow.map((point) => Math.abs(point.net || 0)), 1);
    return cashflow.slice(-7).map((point) => ({
      ...point,
      width: Number(Math.min(100, Number(((Math.abs(point.net || 0) / maxValue) * 100).toFixed(0)))),
    }));
  }, [cashflow]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-sm text-slate-400">Loading financial summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        <h2 className="text-lg font-semibold text-white">Financial Summary</h2>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Financial Summary</h2>
          <p className="text-sm text-slate-400">Cash, income, expenses, tax estimates and runway from WhatsApp/Telegram chat entries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sourceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (onSourceChange) {
                  onSourceChange(option.value as 'all' | 'whatsapp' | 'telegram');
                } else {
                  setInternalSource(option.value as 'all' | 'whatsapp' | 'telegram');
                }
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${source === option.value ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-950/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash Available</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(summary?.currentCashBalance ?? 0)}</p>
          <p className="mt-2 text-xs text-slate-400">Current position from chat-recorded transactions.</p>
        </div>

        <div className="rounded-2xl bg-slate-950/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Income (30d)</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-400">{formatCurrency(summary?.incomeLast30Days ?? 0)}</p>
          <p className="mt-2 text-xs text-slate-400">From customer receipts captured in chat.</p>
        </div>

        <div className="rounded-2xl bg-slate-950/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expenses (30d)</p>
          <p className="mt-3 text-3xl font-semibold text-rose-400">{formatCurrency(summary?.expensesLast30Days ?? 0)}</p>
          <p className="mt-2 text-xs text-slate-400">Chat-based expense entries like paid suppliers and cash outflows.</p>
        </div>

        <div className="rounded-2xl bg-slate-950/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tax Due</p>
          <p className="mt-3 text-3xl font-semibold text-amber-400">{formatCurrency(summary?.taxLast30Days ?? 0)}</p>
          <p className="mt-2 text-xs text-slate-400">Estimate for the current month based on chat-recorded taxable transactions.</p>
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Profit (30d)</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(summary?.profitLast30Days ?? 0)}</p>
              <p className="mt-2 text-xs text-slate-400">Income minus expenses and tax.</p>
            </div>
            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expense Ratio</p>
              <p className="mt-3 text-2xl font-semibold text-cyan-300">{Math.round((summary?.expenseRatio ?? 0) * 100)}%</p>
              <p className="mt-2 text-xs text-slate-400">Expenses as a share of sales over 30 days.</p>
            </div>
            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash Runway</p>
              <p className="mt-3 text-2xl font-semibold text-white">{summary ? (summary.cashRunwayDays !== null ? `${summary.cashRunwayDays} days` : 'N/A') : 'N/A'}</p>
              <p className="mt-2 text-xs text-slate-400">How long cash can cover average daily expenses.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl bg-slate-950/80 p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Cash Flow (last 7 days)</p>
                  <p className="text-xs text-slate-400">Net income, expenses, and running balance from chat-recorded transactions.</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {chartValues.length === 0 ? (
                  <p className="text-sm text-slate-400">No cash flow data available.</p>
                ) : (
                  chartValues.map((point) => (
                    <div key={point.date} className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{point.date}</span>
                        <span>{formatCurrency(point.net)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${point.net >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          style={{ width: `${point.width}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-sm font-semibold text-white">Monthly Expense Categories</p>
              <p className="text-xs text-slate-400">Top categories recorded via WhatsApp / Telegram.</p>

              <div className="mt-4 space-y-3">
                {categories?.categories.length ? (
                  categories.categories.slice(0, 5).map((item) => (
                    <div key={item.category} className="rounded-2xl bg-slate-900/90 p-3">
                      <div className="flex items-center justify-between text-sm text-slate-200">
                        <span>{item.category}</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No expense categories recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-sm font-semibold text-white">Tax Estimate</p>
              <div className="mt-4 space-y-2 text-slate-200">
                <p className="text-base font-semibold text-white">{formatCurrency(taxSummary?.taxDue ?? 0)}</p>
                <p className="text-sm text-slate-400">Total taxable amount: {formatCurrency(taxSummary?.totalTaxable ?? 0)}</p>
                <p className="text-sm text-slate-400">Income this period: {formatCurrency(taxSummary?.totalIncome ?? 0)}</p>
                <p className="text-sm text-slate-400">Expenses this period: {formatCurrency(taxSummary?.totalExpenses ?? 0)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/80 p-5">
              <p className="text-sm font-semibold text-white">Recent Financial Activity</p>
              <div className="mt-4 space-y-3">
                {(summary?.recentTransactions?.length ?? 0) ? (
                  summary?.recentTransactions?.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="rounded-2xl bg-slate-900/90 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="uppercase tracking-[0.2em] text-slate-500">{tx.source}</span>
                        <span>{new Date(tx.date).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-200">{tx.transactionType.toUpperCase()} • {tx.category || 'General'}</p>
                      <p className="mt-1 text-base font-semibold text-white">{formatCurrency(tx.amount)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No recent financial transactions were found.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
