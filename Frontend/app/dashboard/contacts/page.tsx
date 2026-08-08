'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchLeads,
  createLead,
  updateLead,
  deleteLead,
  type LeadItem,
  type LeadCreatePayload,
} from '../../../lib/api';

type LeadFormState = LeadCreatePayload & {
  id?: string;
};

const demoLeadItems: LeadItem[] = [
  {
    id: 'lead-1',
    name: 'Aisha Bello',
    phone: '+234800000011',
    score: 82,
    scoreColor: 'green',
    interactions: 3,
    lastContact: 'Today',
    dueForFollowUp: false,
    nextFollowUp: 'Tomorrow',
    revenue: 120000,
    role: 'Retail Buyer',
  },
  {
    id: 'lead-2',
    name: 'Emeka Okoye',
    phone: '+234800000022',
    score: 68,
    scoreColor: 'yellow',
    interactions: 2,
    lastContact: 'Yesterday',
    dueForFollowUp: true,
    nextFollowUp: 'Today',
    revenue: 86000,
    role: 'Wholesale Distributor',
  },
  {
    id: 'lead-3',
    name: 'Fatima Yusuf',
    phone: '+234800000033',
    score: 54,
    scoreColor: 'red',
    interactions: 1,
    lastContact: '2 days ago',
    dueForFollowUp: true,
    nextFollowUp: 'Next week',
    revenue: 43000,
    role: 'Market Vendor',
  },
];

export default function ContactsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [dummyLeads, setDummyLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<LeadFormState>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    status: 'Active',
    source: 'Manual',
    notes: '',
    leadScore: 0,
    nextFollowUpDate: '',
    conversionValue: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const hasMerchant = Boolean(merchantId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedId = window.localStorage.getItem('merchantId');
    setMerchantId(storedId && storedId !== 'YOUR_MERCHANT_ID_HERE' ? storedId : null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let demoInterval: number | null = null;

    const loadLeads = async () => {
      if (!hasMerchant) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchLeads();
        if (isMounted) {
          setLeads(response.leads);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load lead list');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Do not populate PII-like demo leads. Keep contacts empty and show guidance.

    loadLeads();

    return () => {
      isMounted = false;
      if (demoInterval !== null) window.clearInterval(demoInterval);
    };
  }, [hasMerchant]);

  const resetForm = () => {
    setFormVisible(false);
    setFormMode('create');
    setFormError(null);
    setSuccessMessage(null);
    setFormState({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      company: '',
      status: 'Active',
      source: 'Manual',
      notes: '',
      leadScore: 0,
      nextFollowUpDate: '',
      conversionValue: 0,
    });
  };

  const openCreateForm = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditForm = (lead: LeadItem) => {
    setFormMode('edit');
    setFormVisible(true);
    setFormState({
      id: lead.id,
      firstName: lead.name.split(' ')[0] || '',
      lastName: lead.name.split(' ').slice(1).join(' ') || '',
      phone: lead.phone || '',
      email: lead.email || '',
      company: lead.role || '',
      status: 'Active',
      source: 'Manual',
      notes: '',
      leadScore: lead.score,
      nextFollowUpDate: lead.nextFollowUp || '',
      conversionValue: lead.revenue || 0,
    });
    setFormError(null);
    setSuccessMessage(null);
  };

  const refreshLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLeads();
      setLeads(response.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load lead list');
    } finally {
      setLoading(false);
    }
  };

  const saveLead = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone,
        email: formState.email,
        company: formState.company,
        status: formState.status,
        source: formState.source,
        notes: formState.notes,
        leadScore: formState.leadScore,
        nextFollowUpDate: formState.nextFollowUpDate || undefined,
        conversionValue: formState.conversionValue,
      };

      if (formMode === 'create') {
        await createLead(payload);
        setSuccessMessage('Lead created successfully.');
      } else if (formState.id) {
        await updateLead(formState.id, payload);
        setSuccessMessage('Lead updated successfully.');
      }

      await refreshLeads();
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save lead');
    } finally {
      setSaving(false);
    }
  };

  const removeLead = async (leadId: string) => {
    if (!window.confirm('Delete this lead?')) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await deleteLead(leadId);
      setSuccessMessage('Lead deleted successfully.');
      await refreshLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete lead');
    } finally {
      setSaving(false);
    }
  };

  const displayedLeads = leads.length > 0 ? leads : dummyLeads;

  return (
    <DashboardLayout currentPage="contacts">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Contact CRM</h1>
            <p className="text-slate-300">Live lead pipeline data from the backend leads endpoint.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Add lead
            </button>
            <Link
              href="/dashboard/customers"
              className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Customers
            </Link>
            <Link
              href="/dashboard/customers/campaigns"
              className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Broadcasts
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Quick actions</h2>
              <p className="text-slate-400">Create leads, go to customers, or jump back to the dashboard.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add lead
              </button>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
              >
                Messages
              </Link>
            </div>
          </div>
        </div>

        {formVisible && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {formMode === 'create' ? 'Add new lead' : 'Edit lead'}
                </h2>
                <p className="text-slate-400">Manage the CRM records directly from the dashboard.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>First name</span>
                <input
                  value={formState.firstName}
                  onChange={(event) => setFormState({ ...formState, firstName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="First name"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Last name</span>
                <input
                  value={formState.lastName}
                  onChange={(event) => setFormState({ ...formState, lastName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="Last name"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Phone</span>
                <input
                  value={formState.phone}
                  onChange={(event) => setFormState({ ...formState, phone: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="+234800000000"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Email</span>
                <input
                  value={formState.email}
                  onChange={(event) => setFormState({ ...formState, email: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="email@example.com"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Company</span>
                <input
                  value={formState.company}
                  onChange={(event) => setFormState({ ...formState, company: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="Company"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Lead score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formState.leadScore}
                  onChange={(event) => setFormState({ ...formState, leadScore: Number(event.target.value) || 0 })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Follow-up date</span>
                <input
                  type="date"
                  value={formState.nextFollowUpDate}
                  onChange={(event) => setFormState({ ...formState, nextFollowUpDate: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState({ ...formState, status: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Prospect">Prospect</option>
                </select>
              </label>
            </div>
            {formError && (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{formError}</div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={saveLead}
                disabled={saving}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : formMode === 'create' ? 'Create lead' : 'Update lead'}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-lg">
          {successMessage && (
            <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-200">
              {successMessage}
            </div>
          )}
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">Loading leads...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
          ) : (
            <div className="space-y-6">
              {!hasMerchant && (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-900/5 p-4 text-yellow-100">
                  Demo contacts are loading while your merchant ID is not configured.
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-sm">
                <table className="min-w-full border-collapse text-left text-sm text-slate-200">
                  <thead className="bg-slate-900/90 text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Last Contact</th>
                      <th className="px-4 py-3">Follow-up</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLeads.map((lead) => (
                      <tr key={lead.id} className="border-t border-white/5 hover:bg-slate-900/70 transition">
                        <td className="px-4 py-4 font-medium text-white">{lead.name}</td>
                        <td className="px-4 py-4">{lead.phone}</td>
                        <td className="px-4 py-4">{lead.role || 'N/A'}</td>
                        <td className="px-4 py-4 text-slate-200">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            lead.scoreColor === 'green'
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : lead.scoreColor === 'yellow'
                              ? 'bg-yellow-400/10 text-yellow-300'
                              : 'bg-red-400/10 text-red-300'
                          }`}>
                            {lead.score}
                          </span>
                        </td>
                        <td className="px-4 py-4">{lead.lastContact || 'Unknown'}</td>
                        <td className="px-4 py-4">{lead.dueForFollowUp ? 'Due' : 'Scheduled'}</td>
                        <td className="px-4 py-4">₦{lead.revenue.toFixed(0)}</td>
                        <td className="px-4 py-4 space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(lead)}
                            className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLead(lead.id)}
                            className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {displayedLeads.length === 0 && (
                <div className="rounded-2xl border-t border-white/10 bg-slate-950/50 p-6 text-slate-300">
                  <div className="space-y-4 text-center">
                    <p className="text-lg font-semibold text-white">No leads available yet</p>
                    <p>Add your first lead to start tracking customer conversations and follow ups.</p>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                      >
                        Add lead
                      </button>
                      <Link
                        href="/dashboard/customers"
                        className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        Go to customers
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
              <p className="text-slate-400">Move from contacts to customers, campaigns, or dashboard home without losing your place.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/customers"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Customers
              </Link>
              <Link
                href="/dashboard/customers/campaigns"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Broadcasts
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
