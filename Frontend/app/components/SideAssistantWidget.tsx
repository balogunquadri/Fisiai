'use client';

import { useMemo, useState } from 'react';
import { buildTelegramUrl, buildWhatsAppUrl } from '../../lib/whatsappConfig';

const initialMessages = [
  {
    role: 'assistant',
    text: 'Hi there! I am your Fisi AI assistant. Ask me about inventory, receipts, payments, or stock updates.',
  },
];

export default function SideAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE || process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER || '+2347086024885', 'Hello! I would like help from the FisiAI web assistant.'),
    []
  );
  const telegramUrl = useMemo(
    () => buildTelegramUrl(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'fisi_online_bot', 'Hi! I want to connect with FisiAI on Telegram.'),
    []
  );

  const handleToggle = () => setIsOpen((state) => !state);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError('');
    const userMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error((errorBody && errorBody.error) || 'Unable to contact Fisi assistant');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Fisi assistant failed to respond');
      }

      const assistantMessage = {
        role: 'assistant',
        text: data.reply_text || 'Sorry, I could not generate a response right now.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'I am having trouble reaching Fisi AI right now. Please try again or use WhatsApp/Telegram.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end md:bottom-8 md:right-8">
      {isOpen ? (
        <div className="w-[min(360px,92vw)] rounded-[2rem] border border-white/10 bg-slate-950/95 shadow-2xl shadow-slate-950/40 backdrop-blur-xl text-slate-100">
          <div className="flex items-center justify-between rounded-[1.75rem] border-b border-white/10 bg-slate-900/90 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-white">Fisi AI Assistant</p>
              <p className="text-xs text-slate-400">Powered by Fisi AI for quick business help.</p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700"
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          <div className="max-h-[400px] space-y-3 overflow-y-auto p-4 text-sm">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-3xl px-4 py-3 ${message.role === 'assistant' ? 'bg-slate-900 text-slate-200' : 'bg-emerald-500/10 text-slate-100 self-end'} ${message.role === 'assistant' ? 'self-start' : 'self-end'}`}
              >
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-2 rounded-3xl border border-slate-800 bg-slate-900/90 px-3 py-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask Fisi AI about stock, sales or invoices..."
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>

            {error ? <p className="text-xs text-rose-300">{error}</p> : null}

            <div className="grid gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Chat on WhatsApp
              </a>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                Chat on Telegram
              </a>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-2xl shadow-slate-950/30 transition hover:bg-emerald-300"
          aria-label="Open Fisi assistant"
        >
          <span className="text-xl font-semibold">AI</span>
        </button>
      )}
    </div>
  );
}
