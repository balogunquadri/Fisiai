'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchChatHistory, type ChatHistoryItem, type ChatHistoryResponse } from '../../../lib/api';

export default function WhatsAppInboxPage() {
  const [chatData, setChatData] = useState<ChatHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'telegram'>('all');

  useEffect(() => {
    let isMounted = true;

    const loadChatHistory = async () => {
      try {
        const response = await fetchChatHistory();
        if (isMounted) setChatData(response);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load message history');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadChatHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const renderEventList = (items: Array<{ name?: string; quantity_change?: number; phone: string; email?: string; role?: string }>) => {
    return (
      <ul className="space-y-2 text-sm text-slate-300">
        {items.map((item, idx) => (
          <li key={idx} className="rounded-2xl bg-slate-950/80 p-3">
            {item.name ? (
              <span className="font-medium text-white">{item.name}</span>
            ) : (
              <span className="font-medium text-white">Contact</span>
            )}
            {item.quantity_change !== undefined ? (
              <span className="ml-2 text-slate-400">({item.quantity_change > 0 ? '+' : ''}{item.quantity_change})</span>
            ) : null}
            {item.phone ? <div className="text-xs text-slate-500">{item.phone}</div> : null}
            {item.email ? <div className="text-xs text-slate-500">{item.email}</div> : null}
            {item.role ? <div className="text-xs text-slate-500">{item.role}</div> : null}
          </li>
        ))}
      </ul>
    );
  };

  const filteredMessages = chatData?.messages.filter((message) => {
    if (sourceFilter === 'all') return true;
    return message.source?.toLowerCase() === sourceFilter;
  }) ?? [];

  const sourceCounts = chatData?.messages.reduce(
    (acc, message) => {
      const source = (message.source || 'unknown').toLowerCase();
      if (source === 'telegram') acc.telegram += 1;
      if (source === 'whatsapp') acc.whatsapp += 1;
      return acc;
    },
    { whatsapp: 0, telegram: 0 }
  );

  return (
    <DashboardLayout currentPage="chat">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Messaging Inbox</h1>
          <p className="text-slate-300">Live merchant conversations from WhatsApp and Telegram are consolidated here. Inventory and contact events are extracted from the chat.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Next actions</h2>
              <p className="text-slate-400">From here, check inventory, review customers, or launch a broadcast campaign.</p>
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
                href="/dashboard/customers/campaigns"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Broadcasts
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'whatsapp', 'telegram'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSourceFilter(option)}
              className={`rounded-full px-4 py-2 text-sm transition ${sourceFilter === option ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {option === 'all' ? 'All sources' : option === 'whatsapp' ? `WhatsApp (${sourceCounts?.whatsapp ?? 0})` : `Telegram (${sourceCounts?.telegram ?? 0})`}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Total Messages</p>
            <p className="mt-2 text-3xl font-semibold text-white">{chatData?.stats.total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Unread Inbound</p>
            <p className="mt-2 text-3xl font-semibold text-white">{chatData?.stats.unreadInbound ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Inbound 24h</p>
            <p className="mt-2 text-3xl font-semibold text-white">{chatData?.stats.inboundLast24h ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Inventory Events</p>
            <p className="mt-2 text-3xl font-semibold text-white">{chatData?.stats.inventoryEvents ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Contact Events</p>
            <p className="mt-2 text-3xl font-semibold text-white">{chatData?.stats.contactEvents ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Latest Message</p>
            <p className="mt-2 text-lg font-semibold text-white">{chatData?.stats.latestMessage ? new Date(chatData.stats.latestMessage).toLocaleString() : 'No recent messages'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Messages</h2>
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">Loading chat history...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
          ) : filteredMessages.length ? (
            <div className="space-y-4">
              {filteredMessages.map((message: ChatHistoryItem) => (
                <div key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{message.direction === 'inbound' ? 'Merchant' : 'Agent'}</p>
                      <p className="text-sm text-slate-400">{message.senderPhone}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">{message.mediaType}</span>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${message.source === 'telegram' ? 'bg-cyan-500/10 text-cyan-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                        {message.source?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-slate-200">{message.messageBody}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-1">{message.status}</span>
                  </div>

                  {message.aiExtractedData?.inventoryUpdates?.length ? (
                    <div className="mt-4 rounded-2xl bg-slate-900 p-4">
                      <p className="text-sm font-semibold text-white">Extracted Inventory Events</p>
                      {renderEventList(message.aiExtractedData.inventoryUpdates.map((item) => ({
                        name: item.name,
                        quantity_change: item.quantity_change,
                        phone: '',
                      })))}
                    </div>
                  ) : null}

                  {message.aiExtractedData?.extractedContacts?.length ? (
                    <div className="mt-4 rounded-2xl bg-slate-900 p-4">
                      <p className="text-sm font-semibold text-white">Extracted Contacts</p>
                      {renderEventList(message.aiExtractedData.extractedContacts)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">
              No messages have been recorded yet for the selected source.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
              <p className="text-slate-400">From chat, move to inventory, customers, or broadcasts with a single click.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/inventory"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Inventory
              </Link>
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
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
