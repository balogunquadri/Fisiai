import Image from 'next/image';
import Link from 'next/link';
import MessagingCTA from './components/MessagingCTA';


const features = [
  {
    title: 'Record sales in chat',
    description: 'Send a text message, voice note, or photo and FisiAI turns it into a daily sales record, receipt, or invoice.',
  },
  {
    title: 'AI Insights',
    description: 'Get automatic stock alerts, demand predictions, and trend insights in seconds.',
  },
  {
    title: 'Send and receive payments',
    description: 'Track cash in, cash out, customer payments, and business expenses from one simple WhatsApp or Telegram workflow.',
  },
];

const testimonials = [
  {
    name: 'Mama Ngozi',
    quote: 'Fisi Ai saved me hours of paperwork and prevented stockouts. My market business is finally organized.',
  },
  {
    name: 'Kofi',
    quote: 'The WhatsApp workflow makes it easy for my team to update stock and check sales without learning a new system.',
  },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%)]" />
      <div className="pointer-events-none absolute right-[-10rem] top-1/4 h-[40rem] w-[40rem] rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute left-[-8rem] top-[50%] h-[32rem] w-[32rem] rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        <nav className="flex flex-col gap-6 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 font-bold">SA</span>
            <div>
              <p className="text-sm font-semibold leading-none">Fisi Ai</p>
              <p className="text-xs text-slate-400">Smart stock, simple sales</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300 sm:gap-6">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#stories" className="transition hover:text-white">Merchants</a>
            <Link href="/signin" className="transition hover:text-white">Sign in</Link>
            <Link href="/signup" className="rounded-full bg-emerald-400 px-4 py-2 text-slate-950 font-semibold transition hover:bg-emerald-300">Sign up</Link>
          </div>
        </nav>

        <section className="grid gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              WhatsApp & telegram based sales automation
            </div>
            <div className="space-y-6">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Record daily sales ,  generate receipts, Make Payments and Manage invoices instantly via chat .
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Small businesses can log day-to-day sales with simple text, voice notes, or images on WhatsApp or Telegram. FisiAI turns those chats into organized records, receipts, invoices, and payment updates — so owners can stay on top of cash flow without paperwork.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
                </svg>
                Get started on WhatsApp
              </Link>
               <Link
                href="https://t.me/fisi_online_bot"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-400 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
                </svg>
                Get started on Telegram
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4">
                <p className="text-4xl font-semibold text-white">98%</p>
                <p className="mt-2 text-sm text-slate-400">Merchants reporting faster stock updates</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4">
                <p className="text-4xl font-semibold text-white">2×</p>
                <p className="mt-2 text-sm text-slate-400">Quicker restock decisions</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4">
                <p className="text-4xl font-semibold text-white">24/7</p>
                <p className="mt-2 text-sm text-slate-400">WhatsApp support for every update</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-2xl">
            <div className="absolute -left-8 top-12 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-slate-950/40">
              <div className="rounded-[1.75rem] bg-slate-950/95 p-6 shadow-xl shadow-slate-950/40">
                <div className="flex items-center justify-between rounded-3xl bg-slate-900/90 px-4 py-3 text-sm text-slate-400">
                  <span className="font-semibold text-white">Fisi Ai</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-300 font-semibold">🟢 Online</span>
                </div>
                <div className="mt-6 space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-950 p-4">
                  <div className="flex gap-3">
                    <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-slate-100 max-w-xs">
                      Good morning! I need to check my stock levels for today.
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <div className="rounded-full bg-emerald-500 px-4 py-2 text-sm text-slate-950 max-w-xs font-medium">
                      ✓✓ I found 156 items in stock. Shirts are low - restock soon?
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-slate-100 max-w-xs">
                      How much should I order?
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <div className="rounded-full bg-emerald-500 px-4 py-2 text-sm text-slate-950 max-w-xs font-medium">
                      Based on your sales trend, 200 units would last 5 days. Shall I track your order?
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder-slate-600"
                      />
                      <button className="rounded-full bg-emerald-500 p-2 text-slate-950 hover:bg-emerald-400">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.50612381,0.9 2.40987165,1.00636533 1.77946707,1.4776575 C0.994989822,2.10604706 0.837027403,3.0486314 1.15159189,3.99694501 L3.03521743,10.4379381 C3.03521743,10.5950355 3.34915502,10.7521329 3.50612381,10.7521329 L16.6915026,11.5376198 C16.6915026,11.5376198 17.1624089,11.5376198 17.1624089,12.0088883 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mt-24 rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-sky-300">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">From chat to stock control in moments.</h2>
            </div>
            <div className="text-sm text-slate-400">No app install. No training. Just send messages and stay on top of inventory.</div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">{feature.title}</p>
                <p className="mt-4 text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="stories" className="mt-24 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.28em] text-sky-300">Merchant success stories</p>
            <h2 className="text-3xl font-semibold text-white">Real businesses saving time and avoiding stockouts.</h2>
            <p className="max-w-2xl text-slate-400">
              Fisi Ai brings quick inventory updates, automated restock alerts, and better sales visibility to local merchants. It works in the channel they already use most.
            </p>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-3xl bg-emerald-400/10 text-center leading-[3.5rem] text-emerald-300">M</div>
                <div>
                  <p className="font-semibold text-white">Mama Ngozi</p>
                  <p className="text-sm text-slate-400">Market vendor, Accra</p>
                </div>
              </div>
              <p className="mt-5 text-slate-300">“Fisi Ai saved me hours of paperwork and prevented stockouts. I now know when to buy more before the market day rush.”</p>
            </div>
          </div>

          <div className="space-y-6">
            {testimonials.map((item) => (
              <div key={item.name} className="rounded-3xl border border-white/10 bg-slate-900/75 p-6 text-slate-300 shadow-lg shadow-slate-950/20">
                <p className="text-lg font-semibold text-white">{item.name}</p>
                <p className="mt-4 leading-7">{item.quote}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="start" className="mt-24 rounded-[2rem] border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 p-10 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-sky-300">Get started</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Launch your messaging stock assistant today.</h2>
            </div>
            <MessagingCTA variantName="homepage" provider="whatsapp" />
            <MessagingCTA variantName="homepage" provider="telegram" />
          </div>
        </section>
      </div>
    </main>
  );
}
