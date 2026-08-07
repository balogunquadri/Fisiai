'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminSummary, signOut } from '../../lib/api';

type AdminSummary = {
  success: boolean;
  summary: {
    merchantCount: number;
    activeMerchantCount: number;
    verifiedMerchantCount: number;
    totalActivityCount: number;
    totalFailureCount: number;
  };
  recentSignups: Array<{ name?: string; email: string; phone?: string; isAdmin?: boolean; emailVerified: boolean; createdAt: string }>;
  recentActivity: Array<{ _id: string; action: string; entityType: string; details: any; status: string; createdAt: string }>;
  recentFailures: Array<{ jobId: string; jobType: string; error?: { message?: string }; failureReason: string; createdAt: string }>;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminSummary | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadAdminSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAdminSummary();
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadAdminSummary();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('merchantId');
      }
      router.push('/signin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Hidden Admin Panel</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Admin system monitoring</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              This panel is only accessible to admin users and is not exposed in sidebar navigation.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            Sign out
          </button>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">Loading admin overview...</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-center text-rose-200">
            <p className="text-lg font-semibold">Unable to access admin dashboard.</p>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <button
              onClick={() => router.push('/signin')}
              className="mt-6 rounded-full bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
            >
              Return to sign in
            </button>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Total accounts', value: data.summary.merchantCount },
                { label: 'Active accounts', value: data.summary.activeMerchantCount },
                { label: 'Verified emails', value: data.summary.verifiedMerchantCount },
                { label: 'Activity events', value: data.summary.totalActivityCount },
                { label: 'System failures', value: data.summary.totalFailureCount },
              ].map((card) => (
                <div key={card.label} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Recent signups</h2>
                    <p className="mt-1 text-sm text-slate-400">Latest accounts created across the system.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.recentSignups.length === 0 ? (
                    <p className="text-sm text-slate-400">No recent signups found.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.recentSignups.map((signup) => (
                        <div key={signup.email} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-white">{signup.name || signup.email}</p>
                              <p className="text-sm text-slate-400">{signup.email}</p>
                            </div>
                            <div className="text-right text-sm text-slate-400">
                              <p>{new Date(signup.createdAt).toLocaleString()}</p>
                              <p>{signup.isAdmin ? 'Admin' : 'User'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white">Recent failures</h2>
                  <p className="mt-1 text-sm text-slate-400">Quick view of recent system errors and job failures.</p>
                </div>
                <div className="space-y-4">
                  {data.recentFailures.length === 0 ? (
                    <p className="text-sm text-slate-400">No recent failures logged.</p>
                  ) : (
                    data.recentFailures.map((fail) => (
                      <div key={fail.jobId} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                        <p className="text-sm font-semibold text-white">{fail.jobType}</p>
                        <p className="text-sm text-slate-400">{fail.failureReason}</p>
                        <p className="mt-2 text-xs text-slate-500">{fail.error?.message || 'No error details provided'}</p>
                        <p className="mt-2 text-xs text-slate-500">{new Date(fail.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">System activity log</h2>
                  <p className="mt-1 text-sm text-slate-400">Live audit trail of recent actions across the application.</p>
                </div>
              </div>
              <div className="space-y-3">
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-400">No activity events found.</p>
                ) : (
                  data.recentActivity.map((event) => (
                    <div key={event._id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{event.action}</p>
                          <p className="text-sm text-slate-400">{event.entityType}</p>
                        </div>
                        <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(event.details || {}, null, 2)}</pre>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
