'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  fetchCustomers,
  fetchCustomerBroadcastEvents,
  broadcastCustomers,
  createCustomerBroadcastEvent,
  type CustomerBroadcastEvent,
  type CustomerItem,
} from '../../../../lib/api';

const recurrenceOptions = ['none', 'daily', 'weekly', 'monthly'] as const;
const statusOptions = ['Any', 'Active', 'Prospect', 'Inactive'] as const;

export default function CustomerCampaignsPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [events, setEvents] = useState<CustomerBroadcastEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<typeof statusOptions[number]>('Any');
  const [message, setMessage] = useState('');
  const [eventName, setEventName] = useState('Discount campaign');
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurrence, setRecurrence] = useState<typeof recurrenceOptions[number]>('none');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetchCustomers(undefined, { limit: 200 });
      setCustomers(response.customers);
    } catch (error) {
      console.error('Failed to load customers', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await fetchCustomerBroadcastEvents(undefined);
      setEvents(response.events);
    } catch (error) {
      console.error('Failed to load broadcast events', error);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadEvents();
  }, []);

  const toggleCustomer = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const selectedCount = selectedIds.length;
  const filteredCustomers = useMemo(() => {
    const normalizedTags = tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    return customers.filter((customer) => {
      if (status !== 'Any' && customer.status !== status) return false;
      if (normalizedTags.length > 0) {
        const currentTags = (customer.tags || []).map((tag) => tag.toLowerCase());
        const matches = normalizedTags.some((tag) => currentTags.includes(tag));
        if (!matches) return false;
      }
      return true;
    });
  }, [customers, status, tags]);

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      setActionMessage('Please enter a broadcast message');
      return;
    }
    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        message,
        customerIds: selectedIds.length > 0 ? selectedIds : undefined,
        tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
        status: status !== 'Any' ? status : undefined,
      };
      const response = await broadcastCustomers(undefined, payload);
      setActionMessage(`Broadcast sent to ${response.sent} / ${response.total} customers. ${response.failed} failed.`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleEvent = async () => {
    if (!message.trim()) {
      setActionMessage('Please enter a campaign message before scheduling.');
      return;
    }

    if (!scheduledAt) {
      setActionMessage('Please select a scheduled date and time.');
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        name: eventName,
        message,
        customerIds: selectedIds.length > 0 ? selectedIds : undefined,
        tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
        status: status !== 'Any' ? status : undefined,
        scheduledAt,
        recurrence,
      };
      const response = await createCustomerBroadcastEvent(undefined, payload);
      const sent = response.broadcastResult?.sent ?? 0;
      setActionMessage(
        `Event saved${sent ? ` and sent to ${sent} customers` : ''}.`,
      );
      setEventName('Discount campaign');
      setSelectedIds([]);
      setScheduledAt('');
      setRecurrence('none');
      await loadEvents();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to create campaign event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout currentPage="customers">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Customer Campaigns</h1>
              <p className="text-slate-300">Build broadcasts, schedule discount or giveaway campaigns, and target customers by tag or status.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/customers"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
              >
                Back to customers
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Broadcast quick start</h2>
                <p className="text-slate-400">If you have customers, start by sending a broadcast or schedule a campaign event.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/customers"
                  className="rounded-full border border-white/10 bg-slate-800 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Add customers
                </Link>
                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Send quick broadcast
                </button>
              </div>
            </div>
          </div>
        </div>

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{actionMessage}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Broadcast message</h2>
              <p className="mt-2 text-sm text-slate-400">
                  Send a message to selected customers, or filter by status and tags. Use <span className="font-semibold">{'{name}'}</span> and <span className="font-semibold">{'{company}'}</span> for personalization.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-400">Target status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as typeof statusOptions[number])}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Tags filter</label>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                    placeholder="loyal, vip"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm text-slate-400">Message template</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={7}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  placeholder="Hi {{name}}, enjoy 20% off during our weekend giveaway..."
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  disabled={saving}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Sending…' : 'Send broadcast now'}
                </button>
                <button
                  type="button"
                  onClick={handleScheduleEvent}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Scheduling…' : 'Schedule campaign event'}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Schedule details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-400">Event name</label>
                  <input
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                    placeholder="Weekend discount"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Send date and time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm text-slate-400">Recurrence</label>
                  <select
                    value={recurrence}
                    onChange={(event) => setRecurrence(event.target.value as typeof recurrenceOptions[number])}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  >
                    {recurrenceOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Customer targets</h2>
              <p className="mt-2 text-sm text-slate-400">Pick customers to target directly or leave none selected to use filters only.</p>
              <p className="mt-3 text-sm text-slate-400">Selected customers: {selectedCount}</p>
              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading customers…</p>
                ) : filteredCustomers.length === 0 ? (
                  <p className="text-sm text-slate-400">No matching customers found.</p>
                ) : (
                  filteredCustomers.map((customer) => (
                    <label key={customer.id} className="flex items-center gap-3 rounded-2xl border border-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/90">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
                      />
                      <span>{customer.firstName} {customer.lastName} ({customer.phone})</span>
                    </label>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-white">Upcoming campaign events</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-400">
                {events.length === 0 ? (
                  <p>No scheduled campaign events yet.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{event.name}</span>
                        <span className="text-slate-500">{event.active ? 'Active' : 'Closed'}</span>
                      </div>
                      <p className="mt-2 text-slate-400">Next run: {event.nextRunAt ? new Date(event.nextRunAt).toLocaleString() : 'TBD'}</p>
                      <p className="mt-2 text-slate-400">Recurrence: {event.recurrence}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
