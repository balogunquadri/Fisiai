'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import FinancialSummary from '../components/FinancialSummary';
import { DashboardStats, SalesChart, RestockAlert } from '../components/DashboardComponents';
import {
  fetchAnalyticsInsights,
  fetchChatHistory,
  fetchDashboardSummary,
  fetchInventory,
  fetchLeads,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createLead,
  updateLead,
  deleteLead,
  type AnalyticsInsightResponse,
  type ChatHistoryItem,
  type ChatHistoryResponse,
  type DashboardSummary,
  type InventoryItem,
  type InventoryCreatePayload,
  type InventoryUpdatePayload,
  type LeadItem,
  type LeadCreatePayload,
} from '../../lib/api';

// No sample PII or realistic demo messages are included here.
// When no merchant is configured we display neutral, non-personal placeholder UI only.

export default function DashboardPage() {
  const [chatData, setChatData] = useState<ChatHistoryResponse | null>(null);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsightResponse | null>(null);
  const [demoStats, setDemoStats] = useState({
    inbound: 0,
    outbound: 0,
    inventoryEvents: 0,
    contactEvents: 0,
    unreadInbound: 0,
    inboundLast24h: 0,
  });
  const [demoSummary, setDemoSummary] = useState<DashboardSummary>({
    merchantCount: 1,
    inventoryCount: 0,
    contactCount: 0,
    totalStock: 0,
    harvestedContacts: 0,
    webhookStatus: 'warning',
    recentActivity: [],
  });
  const [financialSource, setFinancialSource] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [leadItems, setLeadItems] = useState<LeadItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [inventoryFormVisible, setInventoryFormVisible] = useState(false);
  const [leadFormVisible, setLeadFormVisible] = useState(false);
  const [inventoryFormMode, setInventoryFormMode] = useState<'create' | 'edit'>('create');
  const [leadFormMode, setLeadFormMode] = useState<'create' | 'edit'>('create');
  const [inventoryFormState, setInventoryFormState] = useState<InventoryCreatePayload & { id?: string }>({
    productName: '',
    quantity: 0,
    price: 0,
    unit: 'pieces',
    category: 'General',
    sku: '',
    cost: 0,
    status: 'Active',
    lastRestocked: '',
  });
  const [leadFormState, setLeadFormState] = useState<LeadCreatePayload & { id?: string }>({
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
  const [savingManage, setSavingManage] = useState(false);

  const hasMerchant = Boolean(process.env.NEXT_PUBLIC_MERCHANT_ID && process.env.NEXT_PUBLIC_MERCHANT_ID !== 'YOUR_MERCHANT_ID_HERE');

  useEffect(() => {
    let isMounted = true;
    let demoInterval: NodeJS.Timeout | null = null;

    const loadDashboard = async () => {
      if (!hasMerchant) {
        setLoading(false);
        return;
      }

      try {
        const [summaryResponse, chatResponse, insightsResponse] = await Promise.all([
          fetchDashboardSummary(),
          fetchChatHistory(),
          fetchAnalyticsInsights(),
        ]);
        if (isMounted) {
          setSummaryData(summaryResponse);
          setChatData(chatResponse);
          setInsights(insightsResponse);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load dashboard data');
          setLoading(false);
        }
      } finally {
        if (isMounted && hasMerchant) {
          setLoading(false);
        }
      }
    };

    // Do not auto-generate demo personal data. Show neutral placeholder UI instead.
    if (!hasMerchant) {
      // Ensure loading cleared so UI renders the neutral empty state
      setLoading(false);
    }

    loadDashboard();

    return () => {
      isMounted = false;
      if (demoInterval) clearInterval(demoInterval);
    };
  }, [hasMerchant]);

  const loadInventoryItems = async () => {
    setInventoryLoading(true);
    setManagementError(null);

    try {
      const data = await fetchInventory(undefined, { status: 'Active', limit: 5, sort: 'low-stock' });
      setInventoryItems(data.items);
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Unable to load inventory preview');
    } finally {
      setInventoryLoading(false);
    }
  };

  const loadLeadItems = async () => {
    setLeadsLoading(true);
    setManagementError(null);

    try {
      const data = await fetchLeads();
      setLeadItems(data.leads.slice(0, 5));
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Unable to load lead preview');
    } finally {
      setLeadsLoading(false);
    }
  };

  const resetInventoryForm = () => {
    setInventoryFormVisible(false);
    setInventoryFormMode('create');
    setInventoryFormState({
      productName: '',
      quantity: 0,
      price: 0,
      unit: 'pieces',
      category: 'General',
      sku: '',
      cost: 0,
      status: 'Active',
      lastRestocked: '',
    });
    setManagementError(null);
  };

  const resetLeadForm = () => {
    setLeadFormVisible(false);
    setLeadFormMode('create');
    setLeadFormState({
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
    setManagementError(null);
  };

  const openCreateInventoryForm = () => {
    resetInventoryForm();
    setInventoryFormVisible(true);
  };

  const openEditInventoryForm = (item: InventoryItem) => {
    setInventoryFormMode('edit');
    setInventoryFormState({
      id: item.id,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      unit: item.unit,
      category: 'General',
      sku: '',
      cost: 0,
      status: 'Active',
      lastRestocked: item.lastRestocked || '',
    });
    setInventoryFormVisible(true);
    setManagementError(null);
  };

  const openCreateLeadForm = () => {
    resetLeadForm();
    setLeadFormVisible(true);
  };

  const openEditLeadForm = (lead: LeadItem) => {
    setLeadFormMode('edit');
    setLeadFormState({
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
    setLeadFormVisible(true);
    setManagementError(null);
  };

  const saveInventoryOverview = async () => {
    setSavingManage(true);
    setManagementError(null);

    try {
      if (inventoryFormMode === 'create') {
        const createPayload: InventoryCreatePayload = {
          productName: inventoryFormState.productName,
          quantity: inventoryFormState.quantity,
          price: inventoryFormState.price,
          unit: inventoryFormState.unit,
          category: inventoryFormState.category,
          sku: inventoryFormState.sku || '',
          cost: inventoryFormState.cost,
          status: inventoryFormState.status,
          lastRestocked: inventoryFormState.lastRestocked || undefined,
        };
        await createInventoryItem(createPayload);
      } else if (inventoryFormState.id) {
        const updatePayload = {
          productName: inventoryFormState.productName,
          quantity: inventoryFormState.quantity,
          price: inventoryFormState.price,
          unit: inventoryFormState.unit,
          category: inventoryFormState.category,
          cost: inventoryFormState.cost,
          status: inventoryFormState.status,
          lastRestocked: inventoryFormState.lastRestocked || undefined,
        };
        await updateInventoryItem(inventoryFormState.id, updatePayload);
      }

      await loadInventoryItems();
      resetInventoryForm();
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to save inventory item');
    } finally {
      setSavingManage(false);
    }
  };

  const deleteInventoryOverview = async (itemId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this inventory item from the dashboard?')) {
      return;
    }

    setSavingManage(true);
    setManagementError(null);

    try {
      await deleteInventoryItem(itemId);
      await loadInventoryItems();
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to delete inventory item');
    } finally {
      setSavingManage(false);
    }
  };

  const saveLeadOverview = async () => {
    setSavingManage(true);
    setManagementError(null);

    try {
      const payload = {
        firstName: leadFormState.firstName,
        lastName: leadFormState.lastName,
        phone: leadFormState.phone,
        email: leadFormState.email,
        company: leadFormState.company,
        status: leadFormState.status,
        source: leadFormState.source,
        notes: leadFormState.notes,
        leadScore: leadFormState.leadScore,
        nextFollowUpDate: leadFormState.nextFollowUpDate || undefined,
        conversionValue: leadFormState.conversionValue,
      };

      if (leadFormMode === 'create') {
        await createLead(payload);
      } else if (leadFormState.id) {
        await updateLead(leadFormState.id, payload);
      }

      await loadLeadItems();
      resetLeadForm();
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to save lead');
    } finally {
      setSavingManage(false);
    }
  };

  const deleteLeadOverview = async (leadId: string) => {
    if (!window.confirm('Remove this lead from the dashboard?')) {
      return;
    }

    setSavingManage(true);
    setManagementError(null);

    try {
      await deleteLead(leadId);
      await loadLeadItems();
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to delete lead');
    } finally {
      setSavingManage(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadOverviewManagement = async () => {
      if (!hasMerchant) {
        setInventoryLoading(false);
        setLeadsLoading(false);
        return;
      }

      if (!isMounted) return;
      await Promise.all([loadInventoryItems(), loadLeadItems()]);
    };

    loadOverviewManagement();

    return () => {
      isMounted = false;
    };
  }, [hasMerchant]);

  const displayedChatStats = chatData?.stats ?? {
    total: 0,
    inbound: 0,
    outbound: 0,
    unreadInbound: 0,
    inboundLast24h: 0,
    inventoryEvents: 0,
    contactEvents: 0,
    latestMessage: null,
    lastBotReply: null,
    channelHealth: {
      meta: { total: 0, success: 0, failure: 0, latest: null },
      twilio: { total: 0, success: 0, failure: 0, latest: null },
      telegram: { total: 0, success: 0, failure: 0, latest: null },
    },
  };

  const displayedSummary = summaryData ?? demoSummary;
  const displayedMessages = chatData?.messages?.slice(0, 4) ?? [];

  const chatInbound = displayedChatStats.inbound;
  const chatOutbound = displayedChatStats.outbound;
  const chatInventoryEvents = displayedChatStats.inventoryEvents;
  const chatContactEvents = displayedChatStats.contactEvents;
  const webhookStatus = chatOutbound || chatInbound ? 'operational' : 'warning';

  const chatUnread = displayedChatStats.unreadInbound;
  const chatInboundLast24h = displayedChatStats.inboundLast24h;
  const lastBotReply = displayedChatStats.lastBotReply;
  const channelHealth = displayedChatStats.channelHealth;

  const chartData = [
    { name: 'WhatsApp', value: Math.min(chatInbound + chatOutbound, 12) },
    { name: 'Inventory', value: Math.min(chatInventoryEvents, 12) },
    { name: 'Contacts', value: Math.min(chatContactEvents, 12) },
  ];

  const forecastAccuracy = insights?.whatWillHappen?.confidence
    ? Math.round(insights.whatWillHappen.confidence * 100)
    : (!hasMerchant ? 72 : 92);
  const confirmedSignals = insights?.analysis?.confirmedTrends?.length ?? (!hasMerchant ? 1 : 0);
  const forecastInsight = insights?.whatWillHappen?.insight || (hasMerchant ? 'AI model trained on 3,400+ transactions' : 'Demo insights will update as real messages arrive');

  const recentMessages = displayedMessages;

  return (
    <DashboardLayout currentPage="overview">
      <div className="space-y-8">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-slate-300">
            Loading WhatsApp-driven dashboard...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
            {error}
          </div>
        ) : chatData || !hasMerchant ? (
          <>
            <DashboardStats
              totalStock={displayedSummary.totalStock}
              harvestedContacts={displayedSummary.harvestedContacts}
              customerRecords={displayedSummary.contactCount ?? 0}
              webhookStatus={webhookStatus}
            />

            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Start here</h2>
                  <p className="text-slate-400">Quickly add a first item, customer, or message campaign from the dashboard.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/dashboard/inventory"
                    className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Add inventory item
                  </Link>
                  <Link
                    href="/dashboard/customers"
                    className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Add customer
                  </Link>
                  <Link
                    href="/dashboard/customers/campaigns"
                    className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Open broadcast
                  </Link>
                  <Link
                    href="/dashboard/chat"
                    className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Review chat
                  </Link>
                </div>
              </div>
            </div>

            {hasMerchant ? (
              <FinancialSummary compact selectedSource={financialSource} onSourceChange={setFinancialSource} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Financial Summary (Demo)</h2>
                    <p className="text-sm text-slate-400">Live balance and cashflow estimates will appear once your merchant ID is configured.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash Available</p>
                      <p className="mt-2 text-2xl font-semibold text-white">₦0</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Income</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-400">₦0</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expenses</p>
                      <p className="mt-2 text-2xl font-semibold text-rose-400">₦0</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tax Due</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-400">₦0</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Messaging Snapshot</h2>
                        <p className="text-sm text-slate-400">Merchant updates from WhatsApp and Telegram are captured and extracted into inventory/contact events.</p>
                      </div>
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300 uppercase text-xs tracking-[0.2em]">
                        Source of truth
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-slate-950/80 p-4">
                        <p className="text-xs text-slate-500">Inbound Messages</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{chatInbound}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950/80 p-4">
                        <p className="text-xs text-slate-500">Outbound Replies</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{chatOutbound}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950/80 p-4">
                        <p className="text-xs text-slate-500">Inventory Events</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{chatInventoryEvents}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950/80 p-4">
                        <p className="text-xs text-slate-500">Contact Events</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{chatContactEvents}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">WhatsApp Analytics</h2>
                      <p className="text-sm text-slate-400">Real-time inbox health and newest bot reply metadata.</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-400 text-xs">Channel health</span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs text-slate-500">Unread Inbound</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{chatUnread}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs text-slate-500">Inbound 24h</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{chatInboundLast24h}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs text-slate-500">Last Bot Reply</p>
                      <p className="mt-2 text-lg font-semibold text-white">{lastBotReply ? lastBotReply.status : 'None'}</p>
                      <p className="text-xs text-slate-500 mt-1">{lastBotReply ? new Date(lastBotReply.createdAt).toLocaleString() : ''}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs text-slate-500">Meta / Twilio / Telegram</p>
                      <p className="mt-2 text-sm text-slate-200">
                        Meta: {channelHealth?.meta.success ?? 0} OK / {channelHealth?.meta.failure ?? 0} Err
                      </p>
                      <p className="text-sm text-slate-200">
                        Twilio: {channelHealth?.twilio.success ?? 0} OK / {channelHealth?.twilio.failure ?? 0} Err
                      </p>
                      <p className="text-sm text-slate-200">
                        Telegram: {channelHealth?.telegram.success ?? 0} OK / {channelHealth?.telegram.failure ?? 0} Err
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Recent Messages</h2>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-400 text-xs">Last {recentMessages.length}</span>
                  </div>
                  <div className="space-y-4">
                    {recentMessages.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">
                        No recent messages found in the WhatsApp inbox.
                      </div>
                    ) : (
                      recentMessages.map((message) => (
                        <div key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{message.direction === 'inbound' ? 'Merchant' : 'Agent'}</p>
                              <p className="text-sm text-slate-400">{message.senderPhone}</p>
                              <p className="text-xs text-slate-500">{message.source?.toUpperCase() || 'WHATSAPP'}</p>
                            </div>
                            <p className="text-xs text-slate-400">{new Date(message.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="mt-3 text-slate-200">{message.messageBody}</p>
                          {message.aiExtractedData?.inventoryUpdates?.length ? (
                            <div className="mt-3 rounded-2xl bg-slate-900 px-3 py-3 text-slate-300">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Inventory events extracted</p>
                              <ul className="list-disc space-y-1 pl-4 text-sm">
                                {message.aiExtractedData.inventoryUpdates.map((event, idx) => (
                                  <li key={idx}>{`${event.name}: ${event.quantity_change > 0 ? '+' : ''}${event.quantity_change}`}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {message.aiExtractedData?.extractedContacts?.length ? (
                            <div className="mt-3 rounded-2xl bg-slate-900 px-3 py-3 text-slate-300">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Contact records extracted</p>
                              <ul className="list-disc space-y-1 pl-4 text-sm">
                                {message.aiExtractedData.extractedContacts.map((contact, idx) => (
                                  <li key={idx}>{`${contact.name || 'Unknown'} • ${contact.phone}${contact.email ? ` • ${contact.email}` : ''}`}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Overview Management</h2>
                    <p className="text-sm text-slate-400">Create, edit, and delete inventory items or leads directly from the dashboard overview.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={openCreateInventoryForm}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      Add item
                    </button>
                    <button
                      type="button"
                      onClick={openCreateLeadForm}
                      className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                    >
                      Add lead
                    </button>
                  </div>
                </div>
                {managementError ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{managementError}</div>
                ) : null}

                {inventoryFormVisible ? (
                  <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{inventoryFormMode === 'create' ? 'New inventory item' : 'Edit inventory item'}</h3>
                        <p className="text-xs text-slate-500">Update product details from the overview.</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetInventoryForm}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Product</span>
                        <input
                          value={inventoryFormState.productName}
                          onChange={(e) => setInventoryFormState({ ...inventoryFormState, productName: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>SKU</span>
                        <input
                          value={inventoryFormState.sku}
                          onChange={(e) => setInventoryFormState({ ...inventoryFormState, sku: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Qty</span>
                        <input
                          type="number"
                          value={inventoryFormState.quantity}
                          onChange={(e) => setInventoryFormState({ ...inventoryFormState, quantity: Number(e.target.value) || 0 })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Price</span>
                        <input
                          type="number"
                          value={inventoryFormState.price}
                          onChange={(e) => setInventoryFormState({ ...inventoryFormState, price: Number(e.target.value) || 0 })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={saveInventoryOverview}
                        disabled={savingManage}
                        className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {savingManage ? 'Saving...' : inventoryFormMode === 'create' ? 'Create item' : 'Update item'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {leadFormVisible ? (
                  <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{leadFormMode === 'create' ? 'New lead' : 'Edit lead'}</h3>
                        <p className="text-xs text-slate-500">Manage contact details from the overview.</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetLeadForm}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>First name</span>
                        <input
                          value={leadFormState.firstName}
                          onChange={(e) => setLeadFormState({ ...leadFormState, firstName: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Last name</span>
                        <input
                          value={leadFormState.lastName}
                          onChange={(e) => setLeadFormState({ ...leadFormState, lastName: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Phone</span>
                        <input
                          value={leadFormState.phone}
                          onChange={(e) => setLeadFormState({ ...leadFormState, phone: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </label>
                      <label className="space-y-2 text-slate-300 text-sm">
                        <span>Email</span>
                        <input
                          value={leadFormState.email}
                          onChange={(e) => setLeadFormState({ ...leadFormState, email: e.target.value })}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={saveLeadOverview}
                        disabled={savingManage}
                        className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
                      >
                        {savingManage ? 'Saving...' : leadFormMode === 'create' ? 'Create lead' : 'Update lead'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Inventory preview</h3>
                      <span className="text-xs text-slate-400">Low stock</span>
                    </div>
                    {inventoryLoading ? (
                      <div className="rounded-2xl bg-slate-900 px-4 py-5 text-slate-300">Loading inventory...</div>
                    ) : inventoryItems.length === 0 ? (
                      <div className="rounded-2xl bg-slate-900 px-4 py-5 text-slate-300">No inventory items available.</div>
                    ) : (
                      <div className="space-y-3">
                        {inventoryItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.name}</p>
                                <p className="text-xs text-slate-400">Qty {item.quantity} • ₦{item.price.toFixed(2)}</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditInventoryForm(item)}
                                  className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteInventoryOverview(item.id)}
                                  className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Lead preview</h3>
                      <span className="text-xs text-slate-400">Top leads</span>
                    </div>
                    {leadsLoading ? (
                      <div className="rounded-2xl bg-slate-900 px-4 py-5 text-slate-300">Loading leads...</div>
                    ) : leadItems.length === 0 ? (
                      <div className="rounded-2xl bg-slate-900 px-4 py-5 text-slate-300">No leads available.</div>
                    ) : (
                      <div className="space-y-3">
                        {leadItems.map((lead) => (
                          <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-white">{lead.name}</p>
                                <p className="text-xs text-slate-400">{lead.phone}</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditLeadForm(lead)}
                                  className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteLeadOverview(lead.id)}
                                  className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
                  <SalesChart data={chartData} />
                </div>

                <RestockAlert />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-white mb-4">🤖 AI-Powered Inventory & Prediction</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Trend Confidence</span>
                    <span className="text-2xl font-bold text-emerald-400">{forecastAccuracy}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-800">
                    <div className="h-full w-3/4 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
                  </div>
                  <p className="text-xs text-slate-500">{insights?.whatHappened?.outlook || 'Live backend analytics trend outlook'}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Confirmed Signals</span>
                    <span className="text-2xl font-bold text-sky-400">{confirmedSignals}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-800">
                    <div className="h-full w-5/6 bg-gradient-to-r from-sky-400 to-cyan-400 rounded-full" />
                  </div>
                  <p className="text-xs text-slate-500">{forecastInsight}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
