'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchTasks,
  fetchDeliveryPartners,
  createTask,
  sendTaskInvite,
  updateDelivery,
  updateTask,
  type DeliveryPartnerItem,
  type TaskItem,
} from '../../../lib/api';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const inviteLabels = {
  pending: 'Pending',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
};

const deliveryLabels = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  enroute: 'En Route',
  delivered: 'Delivered',
  failed: 'Failed',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    channel: 'whatsapp',
    recipientPhone: '',
    recipientChatId: '',
    assignedName: '',
    assignedRole: '',
    dueDate: '',
    deliveryPartner: '',
    pickupLocation: '',
    deliveryAddress: '',
    sendInvite: true,
  });
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTasks(undefined, {});
      setTasks(response.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    loadDeliveryPartners();
  }, []);

  const handleFieldChange = (field: string, value: string | boolean) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const loadDeliveryPartners = async () => {
    try {
      const response = await fetchDeliveryPartners();
      setDeliveryPartners(response.partners || []);
    } catch (err) {
      console.error('Failed to load delivery partners', err);
    }
  };

  const handleCreateTask = async () => {
    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        title: formState.title || (formState.deliveryPartner ? `Delivery booking with ${formState.deliveryPartner}` : 'New task'),
        description: formState.description,
        assignedTo: {
          name: formState.assignedName,
          phone: formState.recipientPhone,
          telegramChatId: formState.recipientChatId,
          role: formState.assignedRole,
        },
        invite: {
          channel: formState.channel,
          recipientPhone: formState.recipientPhone,
          recipientChatId: formState.recipientChatId,
        },
        delivery: {
          partner: formState.deliveryPartner,
          pickupLocation: formState.pickupLocation,
          address: formState.deliveryAddress,
        },
        dueDate: formState.dueDate || undefined,
        sendInvite: formState.sendInvite,
      };

      const result = await createTask(undefined, payload);
      setActionMessage('Task created successfully.');
      setFormState({
        title: '',
        description: '',
        channel: 'whatsapp',
        recipientPhone: '',
        recipientChatId: '',
        assignedName: '',
        assignedRole: '',
        dueDate: '',
        deliveryAddress: '',
        sendInvite: true,
      });
      await loadTasks();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (taskId: string) => {
    setActionMessage(null);
    try {
      await sendTaskInvite(undefined, taskId);
      setActionMessage('Invite sent successfully.');
      await loadTasks();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to send invite');
    }
  };

  const handleUpdateDelivery = async (taskId: string, status: string) => {
    setActionMessage(null);
    try {
      await updateDelivery(undefined, taskId, { status });
      setActionMessage('Delivery status updated.');
      await loadTasks();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Unable to update delivery');
    }
  };

  const actionableTasks = useMemo(() => tasks.filter((task) => task.invite.status !== 'accepted' || task.delivery.status !== 'delivered'), [tasks]);

  return (
    <DashboardLayout currentPage="tasks">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <h1 className="text-2xl font-semibold text-white">Tasks & Delivery Workflows</h1>
          <p className="mt-2 text-sm text-slate-400">Create tasks, send invites to join work items on WhatsApp or Telegram, and update delivery status from the dashboard.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Quick actions</h2>
              <p className="text-slate-400">Create a task, review customers, or go back to dashboard home.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#task-form"
                className="rounded-full border border-white/10 bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Open task form
              </a>
              <Link
                href="/dashboard/customers"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Customers
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

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div id="task-form" className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Create a New Task</h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="text-sm text-slate-300">Title</label>
                <input
                  value={formState.title}
                  onChange={(event) => handleFieldChange('title', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  placeholder="Deliver inventory to market stall"
                />
              </div>

              <div>
                <label className="text-sm text-slate-300">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  placeholder="Pick up 50 crates of tomatoes, deliver to Lagos market."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-300">Assigned To</label>
                  <input
                    value={formState.assignedName}
                    onChange={(event) => handleFieldChange('assignedName', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    placeholder="Driver name"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Role</label>
                  <input
                    value={formState.assignedRole}
                    onChange={(event) => handleFieldChange('assignedRole', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    placeholder="Driver"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-300">Task Channel</label>
                  <select
                    value={formState.channel}
                    onChange={(event) => handleFieldChange('channel', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-300">Due Date</label>
                  <input
                    type="datetime-local"
                    value={formState.dueDate}
                    onChange={(event) => handleFieldChange('dueDate', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-300">Delivery Partner</label>
                  <select
                    value={formState.deliveryPartner}
                    onChange={(event) => handleFieldChange('deliveryPartner', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  >
                    <option value="">Select a delivery partner</option>
                    {deliveryPartners.map((partner) => (
                      <option key={partner.id} value={partner.name}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-300">Pickup Location</label>
                  <input
                    value={formState.pickupLocation}
                    onChange={(event) => handleFieldChange('pickupLocation', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    placeholder="Warehouse 14, Lagos"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-300">Delivery Address</label>
                <input
                  value={formState.deliveryAddress}
                  onChange={(event) => handleFieldChange('deliveryAddress', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                  placeholder="Market Stall 17, Lagos"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-300">Recipient Phone</label>
                  <input
                    value={formState.recipientPhone}
                    onChange={(event) => handleFieldChange('recipientPhone', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    placeholder="2347012345678"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Telegram Chat ID</label>
                  <input
                    value={formState.recipientChatId}
                    onChange={(event) => handleFieldChange('recipientChatId', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formState.sendInvite}
                    onChange={(event) => handleFieldChange('sendInvite', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-400"
                  />
                  Send invite after creating
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateTask}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Create Task'}
                </button>
              </div>
              {actionMessage ? (
                <p className="text-sm text-slate-300">{actionMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Delivery Quick Actions</h2>
            <p className="mt-2 text-sm text-slate-400">Update the delivery status of a task after dispatch or delivery.</p>
            <div className="mt-5 space-y-4">
              {tasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-2xl bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{task.title}</p>
                      <p className="text-sm text-slate-400">Status: {statusLabels[task.status]}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">{deliveryLabels[task.delivery.status]}</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {['dispatched', 'enroute', 'delivered'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleUpdateDelivery(task.id, status)}
                        className="rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        {deliveryLabels[status as keyof typeof deliveryLabels]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Active Tasks</h2>
              <p className="text-sm text-slate-400">View invites, workflow status, and delivery progress for all tasks.</p>
            </div>
            <div>
              <button
                type="button"
                onClick={loadTasks}
                className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 gap-4 bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span className="col-span-2">Title</span>
              <span className="col-span-2">Assigned</span>
              <span className="col-span-2">Invite</span>
              <span className="col-span-2">Delivery</span>
              <span className="col-span-2">Due</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">Loading tasks…</div>
            ) : error ? (
              <div className="px-4 py-10 text-center text-sm text-rose-300">{error}</div>
            ) : tasks.length === 0 ? (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center text-slate-300">
                <p className="text-lg font-semibold text-white">No tasks created yet</p>
                <p>Create your first WhatsApp or Telegram task to automate delivery, reminders, and order collection.</p>
                <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                  <a
                    href="#task-form"
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Create a task
                  </a>
                  <Link
                    href="/dashboard/chat"
                    className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                  >
                    Review messages
                  </Link>
                </div>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="grid grid-cols-12 gap-4 border-t border-white/5 px-4 py-4 text-sm text-slate-200">
                  <span className="col-span-2">{task.title}</span>
                  <span className="col-span-2">{task.assignedTo.name || task.assignedTo.phone || task.assignedTo.telegramChatId || 'Unassigned'}</span>
                  <span className="col-span-2">{inviteLabels[task.invite.status]}</span>
                  <span className="col-span-2">{deliveryLabels[task.delivery.status]}</span>
                  <span className="col-span-2">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                  <span className="col-span-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSendInvite(task.id)}
                      className="rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      Resend Invite
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
