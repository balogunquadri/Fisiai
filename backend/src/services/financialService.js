const FinancialTransaction = require('../models/FinancialTransaction');
const CashBalanceSnapshot = require('../models/CashBalanceSnapshot');
const Merchant = require('../models/Merchant');

function normalizeTransactionPayload(tx) {
  if (!tx || typeof tx !== 'object') return null;

  const rawAmount = Number(tx.amount ?? tx.value ?? tx.total ?? 0);
  if (!Number.isFinite(rawAmount) || rawAmount === 0) return null;

  return {
    transactionType: (tx.transaction_type || tx.transactionType || tx.type || '').toString().toLowerCase().trim(),
    amount: Math.abs(rawAmount),
    currency: (tx.currency || 'NGN').toString().trim().toUpperCase(),
    category: (tx.category || tx.expense_category || tx.type || 'General').toString().trim(),
    paymentMethod: (tx.payment_method || tx.method || '').toString().trim(),
    vendor: (tx.vendor || tx.payee || tx.supplier || '').toString().trim(),
    customer: (tx.customer || tx.payer || '').toString().trim(),
    description: (tx.description || tx.notes || '').toString().trim(),
    taxable: Boolean(tx.taxable || tx.is_taxable),
    taxRate: Number(tx.tax_rate ?? tx.taxRate ?? tx.vat_rate ?? 0) || 0,
    taxAmount: Number(tx.tax_amount ?? tx.taxAmount ?? 0) || 0,
    date: tx.date ? new Date(tx.date) : new Date(),
    transactionTypeNormalized: (tx.transaction_type || tx.transactionType || tx.type || '').toString().toLowerCase().trim(),
  };
}

function buildFinancialQuery(merchantId, source) {
  const query = { merchantId };
  if (source && ['whatsapp', 'telegram'].includes(source)) {
    query.source = source;
  }
  return query;
}

async function getCurrentCashBalance(merchantId, source) {
  if (!source) {
    const snapshot = await CashBalanceSnapshot.findOne({ merchantId }).sort({ date: -1, createdAt: -1 }).lean();
    if (snapshot) {
      return Number(snapshot.balance || 0);
    }
  }

  const match = buildFinancialQuery(merchantId, source);
  const result = await FinancialTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $eq: ['$transactionType', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$transactionType', 'expense'] }, '$amount', 0] } },
        tax: { $sum: { $cond: [{ $eq: ['$transactionType', 'tax'] }, '$amount', 0] } },
      },
    },
  ]);

  const totals = result[0] || {};
  return (totals.income || 0) - (totals.expenses || 0) - (totals.tax || 0);
}

async function recordTransactions(merchantId, messageData, transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { success: true, count: 0 };
  }

  const records = [];
  for (const tx of transactions) {
    const normalized = normalizeTransactionPayload(tx);
    if (!normalized || !['income', 'expense', 'transfer', 'tax', 'adjustment'].includes(normalized.transactionType)) {
      continue;
    }

    const direction = messageData.direction || (normalized.transactionType === 'income' ? 'inbound' : 'outbound');

    records.push({
      merchantId,
      source: messageData.source || 'whatsapp',
      messageId: messageData.messageId || null,
      chatId: messageData.chatId || messageData.recipientChatId || null,
      senderPhone: messageData.from || messageData.senderPhone || null,
      direction,
      transactionType: normalized.transactionType,
      amount: normalized.amount,
      currency: normalized.currency,
      category: normalized.category,
      paymentMethod: normalized.paymentMethod,
      vendor: normalized.vendor,
      customer: normalized.customer,
      description: normalized.description,
      taxable: normalized.taxable,
      taxRate: normalized.taxRate,
      taxAmount: normalized.taxAmount,
      date: normalized.date,
    });
  }

  if (records.length === 0) {
    return { success: true, count: 0 };
  }

  let inserted = 0;
  let netBalanceDelta = 0;

  for (const record of records) {
    try {
      const filter = {
        merchantId: record.merchantId,
        messageId: record.messageId,
        source: record.source,
        transactionType: record.transactionType,
        amount: record.amount,
        date: record.date,
        vendor: record.vendor,
        customer: record.customer,
      };

      const result = await FinancialTransaction.updateOne(
        filter,
        { $setOnInsert: record },
        { upsert: true }
      );

      const wasInserted = (result.upsertedCount || 0) > 0 || (result.upserted && result.upserted.length > 0);
      if (wasInserted) {
        inserted += 1;
        if (record.transactionType === 'income') {
          netBalanceDelta += record.amount;
        } else if (record.transactionType === 'expense' || record.transactionType === 'tax') {
          netBalanceDelta -= record.amount;
        }
      }
    } catch (error) {
      if (error.code === 11000) {
        continue;
      }
      console.error('Error recording financial transaction:', error.message);
    }
  }

  if (inserted > 0) {
    try {
      const previousSnapshot = await CashBalanceSnapshot.findOne({ merchantId }).sort({ date: -1, createdAt: -1 }).lean();
      const previousBalance = previousSnapshot ? Number(previousSnapshot.balance || 0) : 0;
      const newBalance = previousBalance + netBalanceDelta;

      await CashBalanceSnapshot.create({
        merchantId,
        balance: newBalance,
        transactionCount: inserted,
        netChange: netBalanceDelta,
        date: new Date(),
      });
    } catch (snapshotError) {
      console.error('Error creating cash balance snapshot:', snapshotError.message);
    }
  }

  return { success: true, count: inserted };
}

async function getFinancialSummary(merchantId, days = 30, source = null) {
  const startDate = new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);
  const match = { ...buildFinancialQuery(merchantId, source), date: { $gte: startDate } };

  const summary = await FinancialTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$transactionType',
        total: { $sum: '$amount' },
      },
    },
  ]);

  const totals = summary.reduce((acc, row) => {
    acc[row._id] = row.total;
    return acc;
  }, {});

  const currentCashBalance = await getCurrentCashBalance(merchantId, source);
  const incomeLast30Days = totals.income || 0;
  const expensesLast30Days = totals.expense || 0;
  const taxLast30Days = totals.tax || 0;
  const profitLast30Days = incomeLast30Days - expensesLast30Days - taxLast30Days;
  const expenseRatio = incomeLast30Days > 0 ? Number((expensesLast30Days / incomeLast30Days).toFixed(4)) : incomeLast30Days === 0 && expensesLast30Days > 0 ? 1 : 0;
  const averageDailyExpense = expensesLast30Days / (days || 30);
  const cashRunwayDays = averageDailyExpense > 0 ? Number((currentCashBalance / averageDailyExpense).toFixed(1)) : null;
  const cashRunwayMonths = cashRunwayDays !== null ? Number((cashRunwayDays / 30).toFixed(1)) : null;

  const recentTransactions = await FinancialTransaction.find({ ...match })
    .sort({ date: -1 })
    .limit(5)
    .lean();

  return {
    incomeLast30Days,
    expensesLast30Days,
    taxLast30Days,
    profitLast30Days,
    expenseRatio,
    cashRunwayDays,
    cashRunwayMonths,
    currentCashBalance,
    transactionCount: await FinancialTransaction.countDocuments(match),
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx._id,
      source: tx.source,
      transactionType: tx.transactionType,
      amount: tx.amount,
      currency: tx.currency,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      vendor: tx.vendor,
      customer: tx.customer,
      description: tx.description,
      date: tx.date,
      messageId: tx.messageId,
      senderPhone: tx.senderPhone,
      taxable: tx.taxable,
      taxRate: tx.taxRate,
      taxAmount: tx.taxAmount,
    })),
  };
}

async function getExpenseBreakdown(merchantId, days = 30, source = null) {
  const startDate = new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);
  const match = { ...buildFinancialQuery(merchantId, source), transactionType: 'expense', date: { $gte: startDate } };

  const breakdown = await FinancialTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return breakdown.map((item) => ({ category: item._id || 'General', total: item.total }));
}

async function getCashflowTimeline(merchantId, days = 30, source = null) {
  const startDate = new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);

  const match = { ...buildFinancialQuery(merchantId, source), date: { $gte: startDate } };
  const timeline = await FinancialTransaction.aggregate([
    { $match: match },
    {
      $project: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        amount: 1,
        transactionType: 1,
      },
    },
    {
      $group: {
        _id: '$date',
        income: { $sum: { $cond: [{ $eq: ['$transactionType', 'income'] }, '$amount', 0] } },
        expenses: { $sum: { $cond: [{ $eq: ['$transactionType', 'expense'] }, '$amount', 0] } },
        tax: { $sum: { $cond: [{ $eq: ['$transactionType', 'tax'] }, '$amount', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  let runningBalance = 0;
  if (!source) {
    const previousSnapshot = await CashBalanceSnapshot.findOne({ merchantId, date: { $lt: startDate } }).sort({ date: -1, createdAt: -1 }).lean();
    runningBalance = previousSnapshot ? Number(previousSnapshot.balance || 0) : 0;
  } else {
    const prePeriodTotals = await FinancialTransaction.aggregate([
      { $match: { ...buildFinancialQuery(merchantId, source), date: { $lt: startDate } } },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ['$transactionType', 'income'] }, '$amount', 0] } },
          expenses: { $sum: { $cond: [{ $eq: ['$transactionType', 'expense'] }, '$amount', 0] } },
          tax: { $sum: { $cond: [{ $eq: ['$transactionType', 'tax'] }, '$amount', 0] } },
        },
      },
    ]);
    const totals = prePeriodTotals[0] || {};
    runningBalance = (totals.income || 0) - (totals.expenses || 0) - (totals.tax || 0);
  }

  return timeline.map((item) => {
    runningBalance += (item.income || 0) - (item.expenses || 0) - (item.tax || 0);
    return {
      date: item._id,
      income: item.income,
      expenses: item.expenses,
      tax: item.tax,
      net: (item.income || 0) - (item.expenses || 0) - (item.tax || 0),
      runningBalance,
    };
  });
}

async function createTransaction(merchantId, payload = {}) {
  if (!merchantId) throw new Error('merchantId required');

  const normalized = normalizeTransactionPayload(payload);
  if (!normalized) {
    throw new Error('Invalid transaction payload');
  }

  const record = {
    merchantId,
    source: payload.source || 'manual',
    messageId: payload.messageId || null,
    chatId: payload.chatId || null,
    senderPhone: payload.senderPhone || null,
    direction: payload.direction || (normalized.transactionType === 'income' ? 'inbound' : 'outbound'),
    transactionType: normalized.transactionType,
    amount: normalized.amount,
    currency: normalized.currency,
    category: normalized.category,
    paymentMethod: normalized.paymentMethod,
    vendor: normalized.vendor,
    customer: normalized.customer,
    description: normalized.description,
    taxable: normalized.taxable,
    taxRate: normalized.taxRate,
    taxAmount: normalized.taxAmount,
    date: normalized.date,
  };

  // insert with upsert-like protection against duplicates using a simple create
  const created = await FinancialTransaction.create(record);

  // update cash balance snapshot
  try {
    const previousSnapshot = await CashBalanceSnapshot.findOne({ merchantId }).sort({ date: -1, createdAt: -1 }).lean();
    const previousBalance = previousSnapshot ? Number(previousSnapshot.balance || 0) : 0;
    let netDelta = 0;
    if (record.transactionType === 'income') netDelta += record.amount;
    if (record.transactionType === 'expense' || record.transactionType === 'tax') netDelta -= record.amount;

    const newBalance = previousBalance + netDelta;
    await CashBalanceSnapshot.create({ merchantId, balance: newBalance, transactionCount: 1, netChange: netDelta, date: new Date() });
  } catch (err) {
    console.error('Error creating cash balance snapshot after manual transaction:', err?.message || err);
  }

  return { success: true, transaction: created };
}

async function getLatestCashBalance(merchantId) {
  const snapshot = await CashBalanceSnapshot.findOne({ merchantId }).sort({ date: -1, createdAt: -1 }).lean();
  return {
    balance: snapshot?.balance || 0,
    netChange: snapshot?.netChange || 0,
    transactionCount: snapshot?.transactionCount || 0,
    lastUpdatedAt: snapshot?.updatedAt || null,
  };
}

async function getTaxSummary(merchantId, period = 'month', source = null) {
  const now = new Date();
  let startDate = new Date(now);

  if (period === 'year') {
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setMonth(now.getMonth() - 1, 1);
    startDate.setHours(0, 0, 0, 0);
  }

  const match = { ...buildFinancialQuery(merchantId, source), date: { $gte: startDate } };
  const result = await FinancialTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTaxable: { $sum: { $cond: ['$taxable', '$amount', 0] } },
        taxDue: { $sum: '$taxAmount' },
        totalIncome: { $sum: { $cond: [{ $eq: ['$transactionType', 'income'] }, '$amount', 0] } },
        totalExpenses: { $sum: { $cond: [{ $eq: ['$transactionType', 'expense'] }, '$amount', 0] } },
      },
    },
  ]);

  const summary = result[0] || {};
  return {
    period,
    totalTaxable: summary.totalTaxable || 0,
    taxDue: summary.taxDue || 0,
    totalIncome: summary.totalIncome || 0,
    totalExpenses: summary.totalExpenses || 0,
    netProfit: (summary.totalIncome || 0) - (summary.totalExpenses || 0) - (summary.taxDue || 0),
  };
}

async function listTransactions(merchantId, { limit = 25, skip = 0, type, category, source = null } = {}) {
  const query = buildFinancialQuery(merchantId, source);
  if (type) query.transactionType = type;
  if (category) query.category = category;

  const [transactions, total] = await Promise.all([
    FinancialTransaction.find(query)
      .sort({ date: -1 })
      .limit(Math.min(limit, 100))
      .skip(skip)
      .lean(),
    FinancialTransaction.countDocuments(query),
  ]);

  return {
    transactions: transactions.map((tx) => ({
      id: tx._id,
      source: tx.source,
      transactionType: tx.transactionType,
      amount: tx.amount,
      currency: tx.currency,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      vendor: tx.vendor,
      customer: tx.customer,
      description: tx.description,
      date: tx.date,
      messageId: tx.messageId,
      chatId: tx.chatId,
      senderPhone: tx.senderPhone,
      taxable: tx.taxable,
      taxRate: tx.taxRate,
      taxAmount: tx.taxAmount,
    })),
    pagination: {
      total,
      limit: Math.min(limit, 100),
      skip,
    },
  };
}

module.exports = {
  recordTransactions,
  getFinancialSummary,
  getExpenseBreakdown,
  getCashflowTimeline,
  getLatestCashBalance,
  getTaxSummary,
  listTransactions,
  createTransaction,
};
