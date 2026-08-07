'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchActivity, type ActivityLogEntry } from '../../../lib/api';

export default function SalesPage() {
  const [events, setEvents] = useState<ActivityLogEntry[]>([]);
  const [dummyEvents, setDummyEvents] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasMerchant = Boolean(process.env.NEXT_PUBLIC_MERCHANT_ID && process.env.NEXT_PUBLIC_MERCHANT_ID !== 'YOUR_MERCHANT_ID_HERE');

  useEffect(() => {
    let isMounted = true;
    let demoInterval: NodeJS.Timeout | null = null;

    const loadActivity = async () => {
      if (!hasMerchant) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchActivity();
        if (isMounted) {
          setEvents(response.activities);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load activity feed');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // No demo activity events that contain realistic values are added.

    loadActivity();

    return () => {
      isMounted = false;
      if (demoInterval) clearInterval(demoInterval);
    };
  }, [hasMerchant]);

  return (
    <DashboardLayout currentPage="sales">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Activity Feed</h1>
          <p className="text-slate-300">Live event stream from the backend activity endpoint.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Navigation</h2>
              <p className="text-slate-400">Check inventory, customers, and chat without getting stuck.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/inventory"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Inventory
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Messaging
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-lg">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">Loading activity events...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
          ) : (
            <div className="space-y-4">
              {!hasMerchant && (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-900/5 p-4 text-yellow-100">
                  Demo activity events are showing because no merchant ID is configured yet.
                </div>
              )}
              {(events.length > 0 ? events : dummyEvents).length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">
                  No activity events found. Verify backend activity logging is enabled.
                </div>
              ) : (
                <ul className="space-y-4">
                  {(events.length > 0 ? events : dummyEvents).map((event) => (
                    <li key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 hover:bg-slate-950/70 transition">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{event.status}</p>
                          <p className="text-lg font-semibold text-white">{`${event.action} ${event.entity}`}</p>
                        </div>
                        <p className="text-sm text-slate-400">{event.timestamp}</p>
                      </div>
                      <p className="mt-3 text-slate-300">{typeof event.details === 'string' ? event.details : JSON.stringify(event.details)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
              <p className="text-slate-400">Continue from sales to inventory, chat, or dashboard home.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/inventory"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Inventory
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Messaging
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
