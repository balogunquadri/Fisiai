'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import FinancialSummary from '../../components/FinancialSummary';
import { fetchFinancialTransactions, type FinancialTransactionItem } from '../../../lib/api';

const sourceOptions = [
  { label: 'All Sources', value: 'all' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Telegram', value: 'telegram' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
}

export default function FinancePage() {
  const [source, setSource] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const [transactions, setTransactions] = useState<FinancialTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadTransactions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchFinancialTransactions(undefined, source === 'all' ? undefined : source, { limit: 10 });
        if (!isMounted) return;
        setTransactions(response.transactions);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load recent financial transactions');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    loadTransactions();
    return () => {
      isMounted = false;
    };
  }, [source]);

  return (
    <DashboardLayout currentPage="finance">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white">Finance</h1>
          <p className="mt-2 text-sm text-slate-400">Manage cash flow, track expenses, and simplify tax filing using WhatsApp and Telegram transaction capture.</p>
        </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick navigation</h2>
            <p className="text-slate-400">Use these entry points to add inventory, manage customers, or review payments.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/inventory"
              className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Inventory
            </Link>
            <Link
              href="/dashboard/customers"
              className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Customers
            </Link>
            <Link
              href="/dashboard/payments"
              className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Payments
            </Link>
          </div>
        </div>
      </div>

              <h2 className="text-lg font-semibold text-white">Recent Financial Activity</h2>
              <p className="text-sm text-slate-400">Latest income, expenses, tax, and transfers captured from chat-based entries.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSource(option.value as 'all' | 'whatsapp' | 'telegram')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${source === option.value ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
            <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-slate-900 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span className="col-span-3">Date</span>
              <span className="col-span-2">Source</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2">Category</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>
            <div>
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">Loading recent transactions...</div>
              ) : error ? (
                <div className="px-4 py-8 text-center text-sm text-rose-300">{error}</div>
              ) : transactions.length === 0 ? (
                <div className="space-y-4 px-4 py-8 text-center text-sm text-slate-400">
                  <p className="text-lg font-semibold text-white">No recent financial transactions captured yet.</p>
                  <p>Connect purchase or payment chat events to see transaction data here.</p>
                  <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                    <Link
                      href="/dashboard/chat"
                      className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      Review messages
                    </Link>
                    <Link
                      href="/dashboard/payments"
                      className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Update payment settings
                    </Link>
                  </div>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="grid grid-cols-12 gap-4 border-b border-white/5 px-4 py-4 text-sm text-slate-200 last:border-b-0">
                    <span className="col-span-3">{new Date(tx.date).toLocaleDateString()}</span>
                    <span className="col-span-2 capitalize text-cyan-300">{tx.source}</span>
                    <span className="col-span-2 capitalize text-emerald-300">{tx.transactionType}</span>
                    <span className="col-span-2">{tx.category || 'General'}</span>
                    <span className="col-span-3 text-right font-semibold text-white">{formatCurrency(tx.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
