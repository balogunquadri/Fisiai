'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchBankDetails,
  createBankDetail,
  updateBankDetail,
  deleteBankDetail,
  shareBankDetail,
  type BankDetailItem,
} from '../../../lib/api';
import { createFinancialTransaction } from '../../../lib/api';

const initialFormState = {
  id: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  accountType: 'Current',
  branch: '',
  currency: 'NGN',
  notes: '',
  isPrimary: false,
};

export default function PaymentsPage() {
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ amount: 0, transactionType: 'income', currency: 'NGN', category: 'General', description: '', date: '' });
  const [logging, setLogging] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState(initialFormState);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [receivePaymentMode, setReceivePaymentMode] = useState<'list' | 'form'>('list');

  const loadBankDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBankDetails();
      setBankDetails(response.bankDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bank details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBankDetails();
  }, []);

  const resetForm = () => {
    setFormState(initialFormState);
    setFormMode('create');
    setActionMessage(null);
  };

  const editDetail = (detail: BankDetailItem) => {
    setFormMode('edit');
    setFormState({
      id: detail.id,
      bankName: detail.bankName,
      accountName: detail.accountName,
      accountNumber: detail.accountNumber,
      accountType: detail.accountType,
      branch: detail.branch || '',
      currency: detail.currency,
      notes: detail.notes || '',
      isPrimary: detail.isPrimary,
    });
    setReceivePaymentMode('form');
  };

  const saveBankDetail = async () => {
    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        bankName: formState.bankName,
        accountName: formState.accountName,
        accountNumber: formState.accountNumber,
        accountType: formState.accountType,
        branch: formState.branch,
        currency: formState.currency,
        notes: formState.notes,
        isPrimary: formState.isPrimary,
      };

      if (formMode === 'edit' && formState.id) {
        await updateBankDetail(undefined, formState.id, payload);
        setActionMessage('Bank details updated.');
      } else {
        await createBankDetail(undefined, payload);
        setActionMessage('Bank details saved.');
      }

      resetForm();
      setReceivePaymentMode('list');
      await loadBankDetails();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to save bank details');
    } finally {
      setSaving(false);
    }
  };

  const removeBankDetail = async (id: string) => {
    if (!window.confirm('Delete this bank detail?')) return;
    setSaving(true);
    setActionMessage(null);
    try {
      await deleteBankDetail(undefined, id);
      setActionMessage('Bank detail deleted.');
      await loadBankDetails();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to delete bank detail');
    } finally {
      setSaving(false);
    }
  };

  const shareDetail = async (detail: BankDetailItem) => {
    const rawChannel = window.prompt('Share via whatsapp or telegram?');
    if (!rawChannel) {
      setActionMessage('Share cancelled.');
      return;
    }

    const channel = rawChannel.trim().toLowerCase();
    if (channel !== 'whatsapp' && channel !== 'telegram') {
      setActionMessage('Share cancelled. Use whatsapp or telegram.');
      return;
    }

    const payload: { channel: 'whatsapp' | 'telegram'; recipientPhone?: string; recipientChatId?: string } = { channel };
    if (channel === 'whatsapp') {
      const recipientPhone = window.prompt('Enter recipient phone number:');
      if (!recipientPhone) {
        setActionMessage('WhatsApp share cancelled.');
        return;
      }
      payload.recipientPhone = recipientPhone;
    } else {
      const recipientChatId = window.prompt('Enter recipient Telegram chat ID:');
      if (!recipientChatId) {
        setActionMessage('Telegram share cancelled.');
        return;
      }
      payload.recipientChatId = recipientChatId;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      await shareBankDetail(undefined, detail.id, payload);
      setActionMessage('Bank details shared successfully.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to share bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout currentPage="payments">
      <div className="space-y-8">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Payments</h1>
              <p className="mt-2 text-slate-400">Send or receive payments with bank details that can be shared on WhatsApp or Telegram.</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogForm(true)}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Log payment
                </button>
                <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/finance"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Finance
              </Link>
              <Link
                href="/dashboard/customers"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Customers
              </Link>
            </div>
          </div>
        </div>

          {showLogForm ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Log payment</h2>
                  <p className="text-slate-400">Record an incoming or outgoing payment manually.</p>
                </div>
                <button onClick={() => setShowLogForm(false)} className="text-sm text-slate-400">Close</button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-400">Amount</label>
                  <input type="number" value={Number(logForm.amount) || ''} onChange={(e) => setLogForm((p) => ({ ...p, amount: Number(e.target.value) }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Type</label>
                  <select value={logForm.transactionType} onChange={(e) => setLogForm((p) => ({ ...p, transactionType: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Currency</label>
                  <input value={logForm.currency} onChange={(e) => setLogForm((p) => ({ ...p, currency: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Category</label>
                  <input value={logForm.category} onChange={(e) => setLogForm((p) => ({ ...p, category: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-400">Description</label>
                  <input value={logForm.description} onChange={(e) => setLogForm((p) => ({ ...p, description: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Date</label>
                  <input type="datetime-local" value={logForm.date} onChange={(e) => setLogForm((p) => ({ ...p, date: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button disabled={logging} onClick={async () => {
                  setLogging(true);
                  try {
                    if (!logForm.amount || !logForm.transactionType) {
                      alert('Amount and type are required');
                      setLogging(false);
                      return;
                    }
                    const payload = { ...logForm };
                    const resp = await createFinancialTransaction(undefined, payload);
                    if (resp?.success) {
                      alert('Payment logged');
                      setShowLogForm(false);
                      setLogForm({ amount: 0, transactionType: 'income', currency: 'NGN', category: 'General', description: '', date: '' });
                      await loadBankDetails();
                    } else {
                      alert('Failed to log payment');
                    }
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to log payment');
                  } finally {
                    setLogging(false);
                  }
                }} className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">{logging ? 'Logging...' : 'Save payment'}</button>
                <button onClick={() => setShowLogForm(false)} className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700">Cancel</button>
              </div>
            </div>
          ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Send Payment</h2>
            <p className="mt-3 text-slate-400">This workflow will let you send client payments through the chat channels.</p>
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/80 p-6 text-center">
              <p className="text-sm text-slate-400">Feature Coming Soon</p>
              <p className="mt-3 text-lg font-semibold text-white">Send Payment</p>
            </div>
          </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Receive Payment</h2>
              <p className="text-slate-400">Manage bank accounts for receiving customer payments and share them instantly.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setReceivePaymentMode('form');
                }}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add bank details
              </button>
              <button
                type="button"
                onClick={() => setReceivePaymentMode('list')}
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
              >
                View saved accounts
              </button>
            </div>
          </div>

          {actionMessage ? (
            <div className="mt-6 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-200">{actionMessage}</div>
          ) : null}

          {receivePaymentMode === 'form' ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">Bank name</label>
                <input
                  value={formState.bankName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, bankName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Account name</label>
                <input
                  value={formState.accountName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, accountName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Account number</label>
                <input
                  value={formState.accountNumber}
                  onChange={(event) => setFormState((prev) => ({ ...prev, accountNumber: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Account type</label>
                <input
                  value={formState.accountType}
                  onChange={(event) => setFormState((prev) => ({ ...prev, accountType: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Branch</label>
                <input
                  value={formState.branch}
                  onChange={(event) => setFormState((prev) => ({ ...prev, branch: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Currency</label>
                <input
                  value={formState.currency}
                  onChange={(event) => setFormState((prev) => ({ ...prev, currency: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-sm text-slate-400">Notes</label>
                <textarea
                  value={formState.notes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  rows={4}
                />
              </div>
              <div className="lg:col-span-2 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={formState.isPrimary}
                    onChange={(event) => setFormState((prev) => ({ ...prev, isPrimary: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-400"
                  />
                  Mark as primary account
                </label>
              </div>
              <div className="lg:col-span-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveBankDetail}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : formMode === 'edit' ? 'Update bank details' : 'Save bank details'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setReceivePaymentMode('list');
                  }}
                  className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center text-slate-400">Loading bank details…</div>
              ) : bankDetails.length === 0 ? (
                <div className="space-y-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/80 p-6 text-center text-slate-400">
                  <p className="text-lg font-semibold text-white">No bank details added yet</p>
                  <p>Add your first bank account to receive payments and share it directly on WhatsApp or Telegram.</p>
                  <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setReceivePaymentMode('form');
                      }}
                      className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      Add bank details
                    </button>
                    <Link
                      href="/dashboard"
                      className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Dashboard home
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {bankDetails.map((detail) => (
                    <div key={detail.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-white">{detail.bankName}</p>
                          <p className="text-sm text-slate-400">{detail.accountName} — {detail.accountNumber}</p>
                          <p className="text-sm text-slate-400">{detail.accountType} · {detail.currency} · {detail.branch || 'No branch specified'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editDetail(detail)}
                            className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-2 text-xs text-slate-200 hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBankDetail(detail.id)}
                            className="rounded-2xl border border-white/10 bg-rose-500/10 px-4 py-2 text-xs text-rose-200 hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => shareDetail(detail)}
                            className="rounded-2xl border border-white/10 bg-sky-500/10 px-4 py-2 text-xs text-sky-200 hover:bg-sky-500/20"
                          >
                            Share
                          </button>
                        </div>
                      </div>
                      {detail.notes ? <p className="mt-3 text-sm text-slate-500">Notes: {detail.notes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
