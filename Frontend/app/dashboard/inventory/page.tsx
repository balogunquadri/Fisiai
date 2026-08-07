'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  type InventoryItem,
  type InventoryCreatePayload,
} from '../../../lib/api';

const emptyFormState: InventoryCreatePayload & { id?: string } = {
  productName: '',
  quantity: 0,
  price: 0,
  unit: 'pieces',
  category: 'General',
  sku: '',
  cost: 0,
  status: 'Active',
  lastRestocked: '',
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<typeof emptyFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hasMerchant = Boolean(process.env.NEXT_PUBLIC_MERCHANT_ID && process.env.NEXT_PUBLIC_MERCHANT_ID !== 'YOUR_MERCHANT_ID_HERE');

  useEffect(() => {
    let isMounted = true;

    const loadInventory = async () => {
      if (!hasMerchant) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchInventory(undefined, { status: 'Active', limit: 50, sort: 'low-stock' });
        if (isMounted) {
          setItems(data.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load inventory items');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, [hasMerchant]);

  const resetForm = () => {
    setFormState(emptyFormState);
    setFormError(null);
    setFormVisible(false);
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormState(emptyFormState);
    setFormError(null);
    setSuccessMessage(null);
    setFormVisible(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setFormMode('edit');
    setFormState({
      id: item.id,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      unit: item.unit || 'pieces',
      category: 'General',
      sku: '',
      cost: 0,
      status: 'Active',
      lastRestocked: item.lastRestocked || '',
    });
    setFormError(null);
    setSuccessMessage(null);
    setFormVisible(true);
  };

  const reloadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory(undefined, { status: 'Active', limit: 50, sort: 'low-stock' });
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const saveInventoryItem = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload: InventoryCreatePayload = {
        productName: formState.productName,
        quantity: formState.quantity,
        price: formState.price,
        unit: formState.unit,
        category: formState.category,
        cost: formState.cost,
        status: formState.status,
        lastRestocked: formState.lastRestocked || undefined,
        sku: formState.sku || '',
      };

      if (formMode === 'create') {
        await createInventoryItem(payload);
        setSuccessMessage('Inventory item created successfully.');
      } else if (formState.id) {
        await updateInventoryItem(formState.id, payload);
        setSuccessMessage('Inventory item updated successfully.');
      }
      await reloadInventory();
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save inventory item');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!window.confirm('Delete this inventory item?')) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await deleteInventoryItem(itemId);
      setSuccessMessage('Inventory item deleted successfully.');
      await reloadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete inventory item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout currentPage="inventory">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Inventory Hub</h1>
            <p className="text-slate-300">Live inventory, restock risk, and AI confidence from the backend.</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Add inventory item
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Inventory quick actions</h2>
            <p className="text-slate-400 mt-2">Add stock, review customer records, or jump back to the dashboard.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add inventory item
              </button>
              <Link
                href="/dashboard/customers"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Manage customers
              </Link>
              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Review chats
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Next step</h2>
            <p className="text-slate-400 mt-2">If inventory is empty, add your first product to make the dashboard useful.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add first item
              </button>
              <Link
                href="/dashboard/customers"
                className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
              >
                Go to customers
              </Link>
            </div>
          </div>
        </div>

        {formVisible && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {formMode === 'create' ? 'Add inventory item' : 'Edit inventory item'}
                </h2>
                <p className="text-slate-400">Use this form to create or update inventory records.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Product name</span>
                <input
                  value={formState.productName}
                  onChange={(event) => setFormState({ ...formState, productName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="Tomatoes, Rice, Palm Oil"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>SKU</span>
                <input
                  value={formState.sku}
                  onChange={(event) => setFormState({ ...formState, sku: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="SKU-1234"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Quantity</span>
                <input
                  type="number"
                  value={formState.quantity}
                  onChange={(event) => setFormState({ ...formState, quantity: Number(event.target.value) || 0 })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Price</span>
                <input
                  type="number"
                  value={formState.price}
                  onChange={(event) => setFormState({ ...formState, price: Number(event.target.value) || 0 })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Unit</span>
                <input
                  value={formState.unit}
                  onChange={(event) => setFormState({ ...formState, unit: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="pieces"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  value={formState.status}
                  onChange={(event) => setFormState({ ...formState, status: event.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </label>
            </div>
            {formError && (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{formError}</div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={saveInventoryItem}
                disabled={saving}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : formMode === 'create' ? 'Create item' : 'Update item'}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-lg">
          {successMessage && (
            <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-200">
              {successMessage}
            </div>
          )}
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">Loading inventory data...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
          ) : (
            <div className="space-y-6">
              {!hasMerchant && (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-900/5 p-4 text-yellow-100">
                  No merchant configured. Set NEXT_PUBLIC_MERCHANT_ID or connect your messaging channel to load live inventory.
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-sm">
                <table className="min-w-full border-collapse text-left text-sm text-slate-200">
                  <thead className="bg-slate-900/90 text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Margin</th>
                      <th className="px-4 py-3">AI Confidence</th>
                      <th className="px-4 py-3">Last Restocked</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-white/5 hover:bg-slate-900/70 transition">
                        <td className="px-4 py-4 font-medium text-white">{item.name}</td>
                        <td className="px-4 py-4">{item.quantity}</td>
                        <td className="px-4 py-4">{item.unit}</td>
                        <td className="px-4 py-4">₦{item.price.toFixed(2)}</td>
                        <td className="px-4 py-4">{item.margin !== null ? `${item.margin}%` : '—'}</td>
                        <td className="px-4 py-4">{item.aiConfidence !== null && item.aiConfidence !== undefined ? `${item.aiConfidence}%` : 'N/A'}</td>
                        <td className="px-4 py-4">{item.lastRestocked || 'Unknown'}</td>
                        <td className="px-4 py-4 space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-slate-300">
                  <h3 className="text-lg font-semibold text-white">No inventory items yet</h3>
                  <p className="mt-3">
                    Add your first item or connect your merchant data so WhatsApp and Telegram chat updates appear here.
                  </p>
                  <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      Add inventory item
                    </button>
                    <Link
                      href="/dashboard/customers"
                      className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Go to customers
                    </Link>
                    <Link
                      href="/dashboard"
                      className="rounded-full border border-white/10 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Dashboard home
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
