'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Link from 'next/link';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  sendSurveyToCustomer,
  submitCustomerSurveyResponse,
  triggerBirthdayAlerts,
  type CustomerItem,
} from '../../../lib/api';

interface CustomerFormState {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  status: 'Active' | 'Inactive' | 'Prospect';
  tags: string;
  birthday: string;
  notes: string;
  source: string;
}

const initialFormState: CustomerFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  company: '',
  status: 'Active',
  tags: '',
  birthday: '',
  notes: '',
  source: 'Manual',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [formState, setFormState] = useState<CustomerFormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [birthdayMessage, setBirthdayMessage] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const hasMerchant = Boolean(merchantId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedId = window.localStorage.getItem('merchantId');
    setMerchantId(storedId && storedId !== 'YOUR_MERCHANT_ID_HERE' ? storedId : null);
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomers(undefined, { q: searchQuery, limit: 200 });
      setCustomers(response.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasMerchant) {
      setLoading(false);
      return;
    }
    loadCustomers();
  }, [hasMerchant, searchQuery]);

  const resetForm = () => {
    setFormState(initialFormState);
    setFormVisible(false);
    setActionMessage(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEditForm = (customer: CustomerItem) => {
    setFormState({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email || '',
      company: customer.company || '',
      status: customer.status,
      tags: customer.tags.join(', '),
      birthday: customer.birthday ? new Date(customer.birthday).toISOString().slice(0, 10) : '',
      notes: customer.notes || '',
      source: customer.source || 'Manual',
    });
    setFormVisible(true);
    setActionMessage(null);
  };

  const saveCustomer = async () => {
    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone,
        email: formState.email,
        company: formState.company,
        status: formState.status,
        source: formState.source,
        tags: formState.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        birthday: formState.birthday || undefined,
        notes: formState.notes,
      };

      if (formState.id) {
        await updateCustomer(undefined, formState.id, payload);
        setActionMessage('Customer updated successfully.');
      } else {
        await createCustomer(undefined, payload);
        setActionMessage('Customer created successfully.');
      }

      await loadCustomers();
      resetForm();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to save customer');
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (customerId: string) => {
    if (!window.confirm('Delete this customer?')) return;
    setSaving(true);
    setActionMessage(null);
    try {
      await deleteCustomer(undefined, customerId);
      setActionMessage('Customer deleted successfully.');
      await loadCustomers();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to delete customer');
    } finally {
      setSaving(false);
    }
  };

  const handleSendSurvey = async (customerId: string) => {
    const surveyUrl = window.prompt('Survey URL to send to this customer:');
    if (!surveyUrl) return;
    setSaving(true);
    setActionMessage(null);
    try {
      await sendSurveyToCustomer(undefined, customerId, surveyUrl);
      setActionMessage('Survey link sent successfully.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to send survey');
    } finally {
      setSaving(false);
    }
  };

  const handleImportSurveyResponse = async () => {
    const payloadText = window.prompt(
      'Paste survey response as firstName,lastName,phone,email,company,birthday,tags,notes'.trim(),
    );
    if (!payloadText) return;

    const parts = payloadText.split(',').map((part) => part.trim());
    const [firstName, lastName, phone, email, company, birthday, tags, notes] = parts;

    if (!firstName || !phone) {
      setActionMessage('Name and phone are required for survey import.');
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      await submitCustomerSurveyResponse(undefined, {
        firstName,
        lastName: lastName || ' ',
        phone,
        email: email || '',
        company: company || '',
        birthday: birthday || undefined,
        tags: tags ? tags.split('|').map((tag) => tag.trim()).filter(Boolean) : [],
        notes: notes || '',
      });
      setActionMessage('Survey response imported successfully.');
      await loadCustomers();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to import survey response');
    } finally {
      setSaving(false);
    }
  };

  const handleBirthdayAlerts = async () => {
    setBirthdayMessage(null);
    setSaving(true);
    try {
      const response = await triggerBirthdayAlerts(undefined);
      setBirthdayMessage(`Birthday alerts sent: ${response.count}/${response.matches} matching customers.`);
    } catch (err) {
      setBirthdayMessage(err instanceof Error ? err.message : 'Unable to send birthday alerts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout currentPage="customers">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Customers</h1>
            <p className="text-slate-300">Manage your customer records and send survey links from WhatsApp or Telegram.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Add customer
            </button>
            <button
              type="button"
              onClick={handleImportSurveyResponse}
              className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Import survey response
            </button>
            <button
              type="button"
              onClick={handleBirthdayAlerts}
              className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Send birthday alerts
            </button>
            <Link
              href="/dashboard/customers/campaigns"
              className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              Open campaigns
            </Link>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Quick actions</h2>
                <p className="text-slate-400">Start with the next step: add a customer, send birthday alerts, or launch a broadcast campaign.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add customer
              </button>
              <button
                type="button"
                onClick={handleBirthdayAlerts}
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Send birthday alerts
              </button>
              <Link
                href="/dashboard/customers/campaigns"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Open broadcast campaigns
              </Link>
              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Review inventory
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div>
              <h2 className="text-lg font-semibold text-white">Navigation</h2>
              <p className="text-slate-400">Never get stuck: go home or move forward to customer campaigns.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/customers/campaigns"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Go to campaigns
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Customer Directory</h2>
              <p className="text-slate-400">Search and manage your customer records across WhatsApp and Telegram reporting.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="Search by name, phone or email"
              />
              <button
                type="button"
                onClick={loadCustomers}
                className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{actionMessage}</div>
        ) : null}
        {birthdayMessage ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200">{birthdayMessage}</div>
        ) : null}

        {formVisible && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{formState.id ? 'Edit customer' : 'Create customer'}</h2>
                <p className="text-slate-400">Capture name, phone, email, birthday, and customer metadata.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">First name</label>
                <input
                  value={formState.firstName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Last name</label>
                <input
                  value={formState.lastName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Phone</label>
                <input
                  value={formState.phone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Email</label>
                <input
                  value={formState.email}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Company</label>
                <input
                  value={formState.company}
                  onChange={(event) => setFormState((prev) => ({ ...prev, company: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Birthday</label>
                <input
                  type="date"
                  value={formState.birthday}
                  onChange={(event) => setFormState((prev) => ({ ...prev, birthday: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as CustomerFormState['status'] }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Prospect">Prospect</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400">Source</label>
                <input
                  value={formState.source}
                  onChange={(event) => setFormState((prev) => ({ ...prev, source: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-sm text-slate-400">Tags</label>
                <input
                  value={formState.tags}
                  onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  placeholder="loyal, vip, survey" 
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-sm text-slate-400">Notes</label>
                <textarea
                  value={formState.notes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  rows={4}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={saveCustomer}
                disabled={saving}
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save customer'}
              </button>
              <p className="text-sm text-slate-400">Customers can be sourced manually or by survey response and linked via phone number.</p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-lg">
          <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            <span className="col-span-2">Name</span>
            <span className="col-span-2">Phone</span>
            <span className="col-span-2">Email</span>
            <span className="col-span-2">Company</span>
            <span className="col-span-2">Birthday</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">Loading customers…</div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm text-rose-300">{error}</div>
          ) : customers.length === 0 ? (
            <div className="space-y-6 px-4 py-10 text-center text-sm text-slate-400">
              <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-8">
                <p className="text-lg font-semibold text-white">No customers found yet</p>
                <p className="mt-3 text-slate-400">Add your first customer to start sending WhatsApp and Telegram messages, trigger birthday alerts, and create campaigns.</p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Add customer
                  </button>
                  <Link
                    href="/dashboard/customers/campaigns"
                    className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Open broadcast campaigns
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            customers.map((customer) => (
              <div key={customer.id} className="grid grid-cols-12 gap-4 border-t border-white/5 px-4 py-4 text-sm text-slate-200">
                <span className="col-span-2">{customer.firstName} {customer.lastName}</span>
                <span className="col-span-2">{customer.phone}</span>
                <span className="col-span-2">{customer.email || '—'}</span>
                <span className="col-span-2">{customer.company || '—'}</span>
                <span className="col-span-2">{customer.birthday ? new Date(customer.birthday).toLocaleDateString() : '—'}</span>
                <span className="col-span-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(customer)}
                    className="rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendSurvey(customer.id)}
                    className="rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Send survey
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomer(customer.id)}
                    className="rounded-2xl border border-white/10 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
              <p className="text-slate-400">Keep moving forward from customers to campaigns, inventory, or the dashboard home.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/customers/campaigns"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Create broadcast
              </Link>
              <Link
                href="/dashboard/inventory"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                View inventory
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
