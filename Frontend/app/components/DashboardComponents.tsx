'use client';

import { useState } from 'react';

interface ActivityItem {
  id: string;
  name: string;
  type: string;
  description: string;
  timestamp: string;
  tag: string;
  tagColor: 'green' | 'blue' | 'orange';
  avatar: string;
}

interface DashboardStatsProps {
  totalStock: number;
  harvestedContacts: number;
  customerRecords: number;
  webhookStatus: 'operational' | 'warning' | 'error';
}

interface ChartDataPoint {
  name: string;
  value: number;
}

export function DashboardStats({ totalStock, harvestedContacts, customerRecords, webhookStatus }: DashboardStatsProps) {
  const statusConfig = {
    operational: { text: 'Operational', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
    warning: { text: 'Warning', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
    error: { text: 'Error', color: 'text-red-400', bgColor: 'bg-red-400/10' },
  };

  const status = statusConfig[webhookStatus];

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-sm text-slate-400">Total Stock Items</p>
        <div className="mt-4 flex items-end gap-3">
          <p className="text-4xl font-bold text-white">{totalStock}</p>
          <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 5a1 1 0 11-2 0 1 1 0 012 0V2.414L9.707.121a1 1 0 00-1.414 1.414L9.586 3H5a3 3 0 000 6h.5a1 1 0 110 2H5a5 5 0 010-10h4.586L8.293 1.707a1 1 0 011.414-1.414L12 2.414V5z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="mt-4 text-xs text-slate-500">+12% from last week</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-sm text-slate-400">Customer Records</p>
        <div className="mt-4 flex items-end gap-3">
          <p className="text-4xl font-bold text-white">{customerRecords}</p>
          <svg className="h-5 w-5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
          </svg>
        </div>
        <p className="mt-4 text-xs text-slate-500">Total customers stored in CRM.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-sm text-slate-400">Harvested Contacts</p>
        <div className="mt-4 flex items-end gap-3">
          <p className="text-4xl font-bold text-white">{harvestedContacts}</p>
          <svg className="h-5 w-5 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
          </svg>
        </div>
        <p className="mt-4 text-xs text-slate-500">WhatsApp active conversations</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
        <p className="text-sm text-slate-400">AI Webhook Status</p>
        <div className="mt-4 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full animate-pulse ${status.bgColor.replace('bg-', 'bg-')}`} />
          <p className={`text-lg font-semibold ${status.color}`}>{status.text}</p>
          <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="mt-4 text-xs text-slate-500">All systems operational</p>
      </div>
    </div>
  );
}

export function ActivityStream({ activities }: { activities: ActivityItem[] }) {
  const tagColorMap = {
    green: 'bg-emerald-400/10 text-emerald-300',
    blue: 'bg-sky-400/10 text-sky-300',
    orange: 'bg-orange-400/10 text-orange-300',
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Live Conversational Activity Stream</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4 rounded-xl border border-white/5 bg-slate-900/50 p-4 hover:bg-slate-900/70 transition">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-sm font-bold text-slate-950">
              {activity.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{activity.name}</p>
                <p className="text-xs text-slate-500">{activity.timestamp}</p>
              </div>
              <p className="text-xs text-slate-400 mt-1">{activity.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tagColorMap[activity.tagColor]}`}>
                  {activity.tag}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesChart({ data }: { data: ChartDataPoint[] }) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Top Selling Items This Week</h3>
      <div className="space-y-3">
        {data.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{item.name}</span>
              <span className="text-slate-400">{item.value}K</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RestockAlert() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-orange-400/10 p-2">
          <svg className="h-6 w-6 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">Restock Alert</h3>
          <p className="mt-2 text-sm text-slate-300">
            Based on weekend demand trends, expect high demand for "Soft Drinks" by Friday. Draft distributor order?
          </p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition">
              Create Order
            </button>
            <button className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 transition">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
