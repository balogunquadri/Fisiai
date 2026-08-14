'use client';

import { useEffect, useState } from 'react';

const PALETTE: { name: string; hex: string }[] = [
  { name: 'teal', hex: '#14b8a6' },
  { name: 'emerald', hex: '#10b981' },
  { name: 'sky', hex: '#0ea5e9' },
  { name: 'indigo', hex: '#6366f1' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'rose', hex: '#fb7185' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'lime', hex: '#84cc16' },
  { name: 'slate', hex: '#64748b' },
  { name: 'blue', hex: '#2563eb' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#fb923c' },
  { name: 'charcoal', hex: '#0f172a' },
];

export default function ColorPicker({} : {}) {
  const [selected, setSelected] = useState<string>('teal');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('receiptAccentColorName');
    if (stored) setSelected(stored);
    const storedLogo = window.localStorage.getItem('merchantLogoUrl');
    if (storedLogo) setLogoUrl(storedLogo);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const item = PALETTE.find((p) => p.name === selected) || PALETTE[0];
    window.localStorage.setItem('receiptAccentColorName', selected);
    window.localStorage.setItem('receiptAccentColorHex', item.hex);
    // Persist to backend when merchant is signed in
    const merchantId = window.localStorage.getItem('merchantId');
    if (merchantId) {
      fetch(`/api/dashboard/${merchantId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptColorName: selected, receiptColor: item.hex }),
      }).catch((err) => {
        // Non-fatal: just log
        console.warn('Failed to persist receipt color:', err);
      });
    }
  }, [selected]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (typeof window === 'undefined') return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const merchantId = window.localStorage.getItem('merchantId');
      if (!merchantId) {
        alert('Please sign in or set a merchant first to upload a logo.');
        return;
      }
      try {
        setUploading(true);
        const resp = await fetch(`/api/dashboard/${merchantId}/logo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoData: dataUrl }),
        });
        const json = await resp.json();
        if (resp.ok && json.logoUrl) {
          window.localStorage.setItem('merchantLogoUrl', json.logoUrl);
          setLogoUrl(json.logoUrl);
        } else {
          console.warn('Logo upload failed', json);
          alert('Logo upload failed');
        }
      } catch (err) {
        console.warn('Upload error', err);
        alert('Logo upload failed');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveLogo() {
    if (typeof window === 'undefined') return;
    const merchantId = window.localStorage.getItem('merchantId');
    if (!merchantId) return alert('No merchant configured');
    if (!confirm('Remove logo from your account?')) return;
    try {
      setUploading(true);
      const resp = await fetch(`/api/dashboard/${merchantId}/logo`, { method: 'DELETE' });
      const json = await resp.json();
      if (resp.ok && json.success) {
        window.localStorage.removeItem('merchantLogoUrl');
        setLogoUrl('');
      } else {
        console.warn('Failed to remove logo', json);
        alert('Failed to remove logo');
      }
    } catch (err) {
      console.warn('Remove error', err);
      alert('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Receipt & Invoice Color</h3>
          <p className="text-sm text-slate-400">Choose a friendly color name — used as the default accent color.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg shadow-inner" style={{ background: `linear-gradient(135deg, ${PALETTE.find(p=>p.name===selected)?.hex} 0%, #ffffff20 100%)` }} />
            <div className="text-sm text-slate-300">{selected}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {PALETTE.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setSelected(p.name)}
            className={`h-10 rounded-md flex items-center justify-center border ${p.name === selected ? 'ring-2 ring-offset-2 ring-white/20' : 'border-white/10'}`}
            aria-label={`Select ${p.name}`}
            style={{ background: p.hex }}
          >
            <span className="sr-only">{p.name}</span>
            {p.name === selected ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : null}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">Selected color saved to your browser and used when generating PDFs.</p>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-white">Business logo</h4>
        <p className="text-xs text-slate-400">Optional logo shown on receipts and invoices.</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-24 h-12 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
            {logoUrl ? (
              // logoUrl is a public path like /docs/uploads/...
              // use absolute path relative to frontend origin
              <img src={logoUrl} alt="logo" className="max-h-10 max-w-full object-contain" />
            ) : (
              <div className="text-xs text-slate-500">No logo</div>
            )}
          </div>
          <div>
            <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={handleRemoveLogo} disabled={!logoUrl || uploading} className="rounded-md bg-rose-500 px-3 py-1 text-xs text-white">Remove</button>
              {uploading ? <div className="text-xs text-slate-300 mt-1">Working…</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
