const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const DEFAULT_MERCHANT_ID = process.env.NEXT_PUBLIC_MERCHANT_ID || '';

export type DashboardSummary = {
  merchantCount: number;
 inventoryCount: number;
  contactCount: number;
  totalStock: number;
  harvestedContacts: number;
  webhookStatus: 'operational' | 'warning' | 'error';
  recentActivity: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    timestamp: string;
    tag: string;
    tagColor: 'green' | 'blue' | 'orange';
    avatar: string;
  }>;
};

export type MerchantOverviewResponse = {
  success: boolean;
  merchant: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    whatsappBusinessName?: string;
    whatsappBusinessPhone?: string;
    telegramBotUsername?: string;
    telegramChatId?: string | null;
    location?: string;
    category?: string;
    state?: string;
  };
  kpis: {
    lowStockCount: number;
    totalInventoryValue: number;
    hotLeads: number;
    recentActivity: number;
  };
  inventory: Array<{
    name: string;
    quantity: number;
    price: number;
    unit: string;
    value: number;
    status: string;
  }>;
  topLeads: Array<{
    name: string;
    phone: string;
    role: string;
    score: number;
    lastContact?: string;
    value: number;
  }>;
  activitySummary: {
    totalEvents: number;
    lastUpdate?: string;
    processingSuccess: number;
    processingFailure: number;
  };
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  margin: number | null;
  aiConfidence?: number | null;
  lastRestocked?: string;
};

export type InventoryResponse = {
  success: boolean;
  items: InventoryItem[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    pages: number;
  };
};

export type LeadItem = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role?: string;
  score: number;
  scoreColor: 'green' | 'yellow' | 'red';
  interactions?: number;
  lastContact?: string;
  dueForFollowUp?: boolean;
  nextFollowUp?: string;
  revenue: number;
};

export type LeadSummary = {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  dueFollowUp: number;
};

export type LeadResponse = {
  success: boolean;
  leads: LeadItem[];
  summary: LeadSummary;
  pagination: {
    limit: number;
    skip: number;
    pages: number;
  };
};

export type ActivityLogEntry = {
  id: string;
  action: string;
  entity: string;
  status: string;
  details: any;
  timestamp: string;
  error?: string;
};

export type ActivityItem = ActivityLogEntry;

export type ActivityResponse = {
  success: boolean;
  activities: ActivityLogEntry[];
  stats: {
    total: number;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
  };
  pagination: {
    total: number;
    limit: number;
    skip: number;
  };
};

export type FinancialTransactionItem = {
  id: string;
  source: 'whatsapp' | 'telegram' | string;
  transactionType: 'income' | 'expense' | 'transfer' | 'tax' | string;
  amount: number;
  currency: string;
  category: string;
  paymentMethod: string;
  vendor: string;
  customer: string;
  description: string;
  date: string;
  messageId?: string;
  chatId?: string | null;
  senderPhone?: string | null;
  taxable: boolean;
  taxRate: number;
  taxAmount: number;
};

export type FinancialSummaryResponse = {
  success: boolean;
  incomeLast30Days: number;
  expensesLast30Days: number;
  taxLast30Days: number;
  profitLast30Days: number;
  expenseRatio: number;
  cashRunwayDays: number | null;
  cashRunwayMonths: number | null;
  currentCashBalance: number;
  transactionCount: number;
  recentTransactions: FinancialTransactionItem[];
};

export type ExpenseCategoryResponse = {
  success: boolean;
  categories: Array<{ category: string; total: number }>;
};

export type TaxSummaryResponse = {
  success: boolean;
  period: 'month' | 'year';
  totalTaxable: number;
  taxDue: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

export type CashflowPoint = {
  date: string;
  income: number;
  expenses: number;
  tax: number;
  net: number;
  runningBalance: number;
};

export type CashflowResponse = {
  success: boolean;
  timeline: CashflowPoint[];
};

export type FinancialTransactionsResponse = {
  success: boolean;
  transactions: FinancialTransactionItem[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
  };
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  workflowStage: string;
  assignedTo: {
    name: string;
    phone: string;
    telegramChatId: string;
    role: string;
  };
  invite: {
    channel?: 'whatsapp' | 'telegram';
    recipientPhone?: string;
    recipientChatId?: string;
    status: 'pending' | 'sent' | 'accepted' | 'declined';
    messageId?: string;
    sentAt?: string;
    respondedAt?: string;
    responseText?: string;
  };
  delivery: {
    status: 'pending' | 'dispatched' | 'enroute' | 'delivered' | 'failed';
    partner?: string;
    address?: string;
    pickupLocation?: string;
    expectedDeliveryDate?: string;
    completedAt?: string;
    notes?: string;
  };
  dueDate?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type TasksResponse = {
  success: boolean;
  tasks: TaskItem[];
};

export type CustomerItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  company?: string;
  status: 'Active' | 'Inactive' | 'Prospect';
  tags: string[];
  birthday?: string;
  source: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomersResponse = {
  success: boolean;
  customers: CustomerItem[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
  };
};

export type BankDetailItem = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  branch?: string;
  currency: string;
  notes?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BankDetailsResponse = {
  success: boolean;
  bankDetails: BankDetailItem[];
};

export type BankDetailSharePayload = {
  channel: 'whatsapp' | 'telegram';
  recipientPhone?: string;
  recipientChatId?: string;
};

export type SurveyResponse = {
  success: boolean;
  message?: string;
};

export type CustomerBroadcastEvent = {
  id: string;
  name: string;
  message: string;
  customerIds: string[];
  tags: string[];
  status: 'Active' | 'Inactive' | 'Prospect' | 'Any';
  scheduledAt: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  active: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerBroadcastEventsResponse = {
  success: boolean;
  events: CustomerBroadcastEvent[];
};

export type BroadcastResponse = {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
};

export type EventCreateResponse = {
  success: boolean;
  event: CustomerBroadcastEvent;
  broadcastResult?: BroadcastResponse;
};

export type BirthdayAlertResponse = {
  success: boolean;
  count: number;
  matches: number;
};

export type ChatHistoryItem = {
  id: string;
  senderPhone: string;
  source?: string;
  messageBody: string;
  mediaType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'voice';
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  createdAt: string;
  aiExtractedData?: {
    inventoryUpdates?: Array<{ name: string; quantity_change: number }>;
    extractedContacts?: Array<{ name?: string; phone: string; email?: string; role?: string }>;
  };
};

export type ChatHistoryResponse = {
  success: boolean;
  messages: ChatHistoryItem[];
  stats: {
    total: number;
    inbound: number;
    outbound: number;
    unreadInbound: number;
    inboundLast24h: number;
    inventoryEvents: number;
    contactEvents: number;
    latestMessage?: string | null;
    lastBotReply?: {
      messageBody: string;
      createdAt: string;
      status: string;
    } | null;
    channelHealth: {
      meta: {
        total: number;
        success: number;
        failure: number;
        latest: string | null;
      };
      twilio: {
        total: number;
        success: number;
        failure: number;
        latest: string | null;
      };
      telegram: {
        total: number;
        success: number;
        failure: number;
        latest: string | null;
      };
    };
  };
  pagination: {
    total: number;
    limit: number;
    skip: number;
  };
};

export type AnalyticsInsightResponse = {
  success?: boolean;
  merchant?: {
    name: string;
    location: string;
    category: string;
  };
  whatHappened?: {
    confidence?: number;
    insight?: string;
    outlook?: string;
    items?: Array<{ item: string; growthPercentage?: number }>;
  };
  whatWillHappen?: {
    confidence?: number;
    insight?: string;
    risks?: Array<{ item?: string; reason?: string }>;
    items?: Array<{ item: string; growthPercentage?: number }>;
  };
  analysis?: {
    confirmedTrends?: string[];
    actionItems?: Array<{ item?: string; action?: string; reason?: string }>;
  };
};

export type WhatsAppConfigResponse = {
  success: boolean;
  businessPhoneNumber: string;
  businessName: string;
  phoneNumberId?: string;
};

export type TelegramConfigResponse = {
  success: boolean;
  botUsername: string;
  chatId?: string | null;
  deepLink?: string;
  botConfigured: boolean;
};

export type JobFailureItem = {
  jobId: string;
  jobType: 'webhook-process' | 'media-process';
  messageId?: string;
  senderPhone?: string;
  failureReason: string;
  attemptNumber: number;
  maxAttempts: number;
  error?: {
    message: string;
    code?: string;
  };
  createdAt: string;
};

export type FailureStatsResponse = {
  success: boolean;
  stats: {
    totalFailures: number;
    deadLetteredCount: number;
    unresolvedCount: number;
    retryableCount: number;
    failuresByReason: Record<string, number>;
    failuresByJobType: Record<string, number>;
    timeRange: string;
  };
  recentFailures: JobFailureItem[];
  retryMetrics?: {
    totalFailedJobs: number;
    jobsWithRetries: number;
    successfulRetries: number;
    retrySuccessRate: string;
    timeRange: string;
  };
  timeRange: string;
};

export type DeadLetterQueueResponse = {
  success: boolean;
  items: Array<{
    jobId: string;
    jobType: string;
    messageId?: string;
    senderPhone?: string;
    deadLetterReason: string;
    createdAt: string;
    error?: {
      message: string;
    };
  }>;
  pagination: {
    total: number;
    limit: number;
    skip: number;
  };
};

export type AdminSummaryResponse = {
  success: boolean;
  summary: {
    merchantCount: number;
    activeMerchantCount: number;
    verifiedMerchantCount: number;
    totalActivityCount: number;
    totalFailureCount: number;
  };
  recentSignups: Array<{
    name?: string;
    email: string;
    phone?: string;
    isAdmin?: boolean;
    emailVerified: boolean;
    createdAt: string;
  }>;
  recentActivity: Array<{
    _id: string;
    action: string;
    entityType: string;
    details: any;
    status: string;
    createdAt: string;
  }>;
  recentFailures: Array<{
    jobId: string;
    jobType: string;
    error?: {
      message?: string;
    };
    failureReason: string;
    createdAt: string;
  }>;
};

const resolveMerchantId = (merchantId?: string) => merchantId || DEFAULT_MERCHANT_ID;

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load dashboard data');
  }

  return response.json();
}

export async function fetchMerchantOverview(merchantId?: string): Promise<MerchantOverviewResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for merchant overview requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load merchant overview');
  }

  return response.json();
}

export type InventoryCreatePayload = {
  productName: string;
  quantity: number;
  price: number;
  unit?: string;
  category?: string;
  sku: string;
  cost?: number;
  status?: string;
  lastRestocked?: string;
};

export type InventoryUpdatePayload = Partial<InventoryCreatePayload>;

export async function fetchInventory(
  merchantId?: string,
  query: {
    status?: string;
    limit?: number;
    skip?: number;
    sort?: string;
  } = {}
): Promise<InventoryResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for inventory requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.sort) params.append('sort', query.sort);
  if (query.limit) params.append('limit', String(query.limit));
  if (query.skip) params.append('skip', String(query.skip));

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/inventory?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load inventory data');
  }

  return response.json();
}

export async function createInventoryItem(
  payload: InventoryCreatePayload,
  merchantId?: string
): Promise<{ success: boolean; item: InventoryItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for inventory requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create inventory item');
  }

  return response.json();
}

export async function updateInventoryItem(
  itemId: string,
  payload: InventoryUpdatePayload,
  merchantId?: string
): Promise<{ success: boolean; item: InventoryItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for inventory requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/inventory/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update inventory item');
  }

  return response.json();
}

export async function deleteInventoryItem(itemId: string, merchantId?: string): Promise<{ success: boolean; deletedId: string }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for inventory requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/inventory/${itemId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete inventory item');
  }

  return response.json();
}

export type LeadCreatePayload = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  company?: string;
  status?: string;
  source?: string;
  notes?: string;
  leadScore?: number;
  nextFollowUpDate?: string;
  conversionValue?: number;
};

export type LeadUpdatePayload = Partial<LeadCreatePayload>;

export async function createLead(payload: LeadCreatePayload, merchantId?: string): Promise<{ success: boolean; lead: LeadItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for lead requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create lead');
  }

  return response.json();
}

export async function updateLead(leadId: string, payload: LeadUpdatePayload, merchantId?: string): Promise<{ success: boolean; lead: LeadItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for lead requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/leads/${leadId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update lead');
  }

  return response.json();
}

export async function deleteLead(leadId: string, merchantId?: string): Promise<{ success: boolean; deletedId: string }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for lead requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete lead');
  }

  return response.json();
}

export async function fetchLeads(merchantId?: string): Promise<LeadResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for lead requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/leads?minScore=0&limit=50`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load leads data');
  }

  return response.json();
}

export async function fetchActivity(merchantId?: string): Promise<ActivityResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for activity requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/activity?limit=20`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load activity data');
  }

  return response.json();
}

export async function fetchChatHistory(merchantId?: string): Promise<ChatHistoryResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for chat history requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/chat?limit=50`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load chat history');
  }

  return response.json();
}

export async function fetchAnalyticsInsights(merchantId?: string): Promise<AnalyticsInsightResponse | null> {
  const resolvedMerchantId = resolveMerchantId(merchantId);

  if (!resolvedMerchantId) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/analytics/insights/${resolvedMerchantId}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function signOut(): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/signout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to sign out');
  }

  return response.json();
}

export async function fetchAdminStatus(): Promise<{ success: boolean; isAdmin: boolean; email?: string; adminEmails?: string[] }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/status`, {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load admin status');
  }

  return response.json();
}

export async function fetchAdminSummary(): Promise<AdminSummaryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/summary`, {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load admin summary');
  }

  return response.json();
}

export async function fetchFinancialSummary(merchantId?: string, source?: string, days = 30): Promise<FinancialSummaryResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for financial summary requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  params.append('days', String(days));
  if (source) params.append('source', source);

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/financials?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load financial summary');
  }

  return response.json();
}

export async function fetchExpenseBreakdown(merchantId?: string, source?: string, days = 30): Promise<ExpenseCategoryResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for expense breakdown requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  params.append('days', String(days));
  if (source) params.append('source', source);

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/expenses?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load expense breakdown');
  }

  return response.json();
}

export async function fetchTaxSummary(merchantId?: string, period: 'month' | 'year' = 'month', source?: string): Promise<TaxSummaryResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for tax summary requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  params.append('period', period);
  if (source) params.append('source', source);

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tax-summary?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load tax summary');
  }

  return response.json();
}

export async function fetchCashflow(merchantId?: string, source?: string, days = 30): Promise<CashflowResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for cashflow requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  params.append('days', String(days));
  if (source) params.append('source', source);

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/cashflow?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load cashflow data');
  }

  return response.json();
}

export async function fetchFinancialTransactions(
  merchantId?: string,
  source?: string,
  query: { limit?: number; skip?: number; type?: string; category?: string } = {}
): Promise<FinancialTransactionsResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for financial transaction requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const params = new URLSearchParams();
  if (source) params.append('source', source);
  if (query.type) params.append('type', query.type);
  if (query.category) params.append('category', query.category);
  if (query.limit) params.append('limit', String(query.limit));
  if (query.skip) params.append('skip', String(query.skip));

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/financial-transactions?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load financial transactions');
  }

  return response.json();
}

export async function createFinancialTransaction(
  merchantId: string | undefined,
  payload: {
    transactionType: string;
    amount: number;
    currency?: string;
    category?: string;
    paymentMethod?: string;
    vendor?: string;
    customer?: string;
    description?: string;
    date?: string;
  }
): Promise<{ success: boolean; transaction?: any }>
{
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for financial transaction requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/financial-transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to create financial transaction');
  }

  return response.json();
}

export async function fetchTasks(
  merchantId?: string,
  params: { status?: string; inviteStatus?: string; deliveryStatus?: string } = {}
): Promise<TasksResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for task requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.inviteStatus) query.append('inviteStatus', params.inviteStatus);
  if (params.deliveryStatus) query.append('deliveryStatus', params.deliveryStatus);

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tasks?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load tasks');
  }

  return response.json();
}

export type DeliveryPartnerItem = {
  id: string;
  name: string;
  description: string;
  contact: string;
};

export async function fetchDeliveryPartners(merchantId?: string): Promise<{ success: boolean; partners: DeliveryPartnerItem[] }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for delivery partner requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/delivery-partners`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load delivery partners');
  }

  return response.json();
}

export async function createTask(merchantId?: string, payload?: any): Promise<{ success: boolean; task: TaskItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to create tasks. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tasks`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create task');
  }

  return response.json();
}

export async function updateTask(merchantId?: string, taskId?: string, payload?: any): Promise<{ success: boolean; task: TaskItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to update tasks. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!taskId) {
    throw new Error('Task ID is required to update a task.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update task');
  }

  return response.json();
}

export async function sendTaskInvite(merchantId?: string, taskId?: string): Promise<{ success: boolean; task: TaskItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to send task invites. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!taskId) {
    throw new Error('Task ID is required to send task invites.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tasks/${taskId}/invite`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to send task invite');
  }

  return response.json();
}

export async function updateDelivery(merchantId?: string, taskId?: string, payload?: any): Promise<{ success: boolean; task: TaskItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to update delivery details. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!taskId) {
    throw new Error('Task ID is required to update delivery details.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/tasks/${taskId}/delivery`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update delivery status');
  }

  return response.json();
}

export async function fetchBankDetails(merchantId?: string): Promise<BankDetailsResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for bank detail requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/payments/bank-details`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load bank details');
  }

  return response.json();
}

export async function createBankDetail(merchantId?: string, payload?: any): Promise<{ success: boolean; bankDetail: BankDetailItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to create bank details. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/payments/bank-details`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create bank detail');
  }

  return response.json();
}

export async function updateBankDetail(merchantId?: string, bankDetailId?: string, payload?: any): Promise<{ success: boolean; bankDetail: BankDetailItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to update bank details. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!bankDetailId) {
    throw new Error('Bank detail ID is required to update a bank detail.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/payments/bank-details/${bankDetailId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update bank detail');
  }

  return response.json();
}

export async function deleteBankDetail(merchantId?: string, bankDetailId?: string): Promise<{ success: boolean; deletedId: string }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to delete bank details. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!bankDetailId) {
    throw new Error('Bank detail ID is required to delete a bank detail.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/payments/bank-details/${bankDetailId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete bank detail');
  }

  return response.json();
}

export async function shareBankDetail(merchantId?: string, bankDetailId?: string, payload?: BankDetailSharePayload): Promise<{ success: boolean; bankDetail: BankDetailItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to share bank detail. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!bankDetailId) {
    throw new Error('Bank detail ID is required to share bank detail.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/payments/bank-details/${bankDetailId}/share`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to share bank detail');
  }

  return response.json();
}

export async function fetchCustomers(merchantId?: string, params: { q?: string; limit?: number; skip?: number } = {}): Promise<CustomersResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required for customer requests. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.skip) query.append('skip', String(params.skip));

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load customers');
  }

  return response.json();
}

export async function createCustomer(merchantId?: string, payload?: any): Promise<{ success: boolean; customer: CustomerItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to create customers. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create customer');
  }

  return response.json();
}

export async function updateCustomer(merchantId?: string, customerId?: string, payload?: any): Promise<{ success: boolean; customer: CustomerItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to update customers. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!customerId) {
    throw new Error('Customer ID is required to update a customer.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/${customerId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to update customer');
  }

  return response.json();
}

export async function deleteCustomer(merchantId?: string, customerId?: string): Promise<{ success: boolean; deletedId: string }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to delete customers. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!customerId) {
    throw new Error('Customer ID is required to delete a customer.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/${customerId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete customer');
  }

  return response.json();
}

export async function submitCustomerSurveyResponse(merchantId?: string, payload?: any): Promise<{ success: boolean; customer: CustomerItem }> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to submit survey responses. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/survey-response`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to submit survey response');
  }

  return response.json();
}

export async function broadcastCustomers(
  merchantId?: string,
  payload?: {
    message: string;
    customerIds?: string[];
    tags?: string[];
    status?: string;
  },
): Promise<BroadcastResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to broadcast to customers. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/broadcast`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to broadcast message');
  }

  return response.json();
}

export async function createCustomerBroadcastEvent(
  merchantId?: string,
  payload?: {
    name?: string;
    message: string;
    customerIds?: string[];
    tags?: string[];
    status?: string;
    scheduledAt?: string;
    recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  },
): Promise<EventCreateResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to create a customer broadcast event. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/broadcast-event`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to create broadcast event');
  }

  return response.json();
}

export async function fetchCustomerBroadcastEvents(merchantId?: string): Promise<CustomerBroadcastEventsResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to fetch broadcast events. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/broadcast-events`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load broadcast events');
  }

  const result = await response.json();
  if (result.events && Array.isArray(result.events)) {
    result.events = result.events.map((event: any) => ({
      ...event,
      id: event.id || event._id || event._id?.toString() || '',
    }));
  }

  return result;
}

export async function sendSurveyToCustomer(merchantId?: string, customerId?: string, surveyUrl?: string): Promise<SurveyResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to send surveys. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }
  if (!customerId) {
    throw new Error('Customer ID is required to send a survey.');
  }
  if (!surveyUrl) {
    throw new Error('Survey URL is required.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/${customerId}/send-survey`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ surveyUrl }),
  });

  if (!response.ok) {
    throw new Error('Failed to send survey');
  }

  return response.json();
}

export async function triggerBirthdayAlerts(merchantId?: string, date?: string): Promise<BirthdayAlertResponse> {
  const resolvedMerchantId = resolveMerchantId(merchantId);
  if (!resolvedMerchantId) {
    throw new Error('Merchant ID is required to trigger birthday alerts. Set NEXT_PUBLIC_MERCHANT_ID in the frontend env.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/customers/send-birthday-alerts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(date ? { date } : {}),
  });

  if (!response.ok) {
    throw new Error('Failed to trigger birthday alerts');
  }

  return response.json();
}

export async function fetchWhatsAppConfig(merchantId?: string): Promise<WhatsAppConfigResponse | null> {
  const resolvedMerchantId = resolveMerchantId(merchantId);

  if (!resolvedMerchantId) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/whatsapp-config`, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function fetchTelegramConfig(merchantId?: string): Promise<TelegramConfigResponse | null> {
  const resolvedMerchantId = resolveMerchantId(merchantId);

  if (!resolvedMerchantId) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/telegram-config`, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function fetchFailureMetrics(merchantId?: string, timeRange: number = 24): Promise<FailureStatsResponse | null> {
  const resolvedMerchantId = resolveMerchantId(merchantId);

  if (!resolvedMerchantId) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/failures?timeRange=${timeRange}`,
      {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function fetchDeadLetterQueue(merchantId?: string, limit: number = 20): Promise<DeadLetterQueueResponse | null> {
  const resolvedMerchantId = resolveMerchantId(merchantId);

  if (!resolvedMerchantId) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/${resolvedMerchantId}/dead-letter-queue?limit=${limit}`,
      {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function retryFailedJob(merchantId: string, jobId: string): Promise<{ success: boolean; message: string } | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/${merchantId}/retry-failed-job`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ jobId }),
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}
