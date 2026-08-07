'use client';

import { useEffect, useState } from 'react';
import {
  getWhatsAppCTAConfig,
  getTelegramCTAConfig,
  buildWhatsAppUrl,
  buildTelegramUrl,
  fetchMerchantWhatsAppConfig,
  fetchMerchantTelegramConfig,
} from '../../lib/whatsappConfig';

interface MessagingCTAProps {
  /**
   * Messaging provider to use for the CTA
   */
  provider?: 'whatsapp' | 'telegram';

  /**
   * Variant name from CTA variants config ('homepage', 'signupFlow', etc.)
   */
  variantName?: string;

  /**
   * Override display type: 'button', 'link', or 'banner'
   */
  displayVariant?: 'button' | 'link' | 'banner';

  /**
   * Override phone number (WhatsApp only)
   */
  phoneNumber?: string;

  /**
   * Override Telegram bot username (Telegram only)
   */
  botUsername?: string;

  /**
   * Override message text
   */
  message?: string;

  /**
   * Override label/text
   */
  label?: string;

  /**
   * Merchant ID to fetch business messaging config
   */
  merchantId?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export default function MessagingCTA({
  provider = 'whatsapp',
  variantName = 'homepage',
  displayVariant,
  phoneNumber: propPhoneNumber,
  botUsername: propBotUsername,
  message: propMessage,
  label: propLabel,
  merchantId,
  className = '',
}: MessagingCTAProps) {
  const [clicked, setClicked] = useState(false);
  const [config, setConfig] = useState(
    provider === 'telegram'
      ? getTelegramCTAConfig(variantName)
      : getWhatsAppCTAConfig(variantName)
  );
  const [merchantPhone, setMerchantPhone] = useState<string | null>(null);
  const [merchantBotUsername, setMerchantBotUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!merchantId);

  useEffect(() => {
    if (!merchantId) {
      setLoading(false);
      return;
    }

    const loadMerchantConfig = async () => {
      try {
        if (provider === 'telegram') {
          const result = await fetchMerchantTelegramConfig(merchantId);
          if (result) {
            setMerchantBotUsername(result.botUsername);
          }
        } else {
          const result = await fetchMerchantWhatsAppConfig(merchantId);
          if (result) {
            setMerchantPhone(result.businessPhoneNumber);
          }
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadMerchantConfig();
  }, [merchantId, provider]);

  useEffect(() => {
    const finalConfig =
      provider === 'telegram'
        ? getTelegramCTAConfig(variantName, {
            botUsername: propBotUsername || merchantBotUsername || undefined,
            message: propMessage,
            variant: displayVariant,
            label: propLabel,
          })
        : getWhatsAppCTAConfig(variantName, {
            phoneNumber: propPhoneNumber || merchantPhone || undefined,
            message: propMessage,
            variant: displayVariant,
            label: propLabel,
          });

    setConfig(finalConfig);
  }, [provider, variantName, propPhoneNumber, merchantPhone, propBotUsername, merchantBotUsername, propMessage, displayVariant, propLabel]);

  if (loading) {
    return (
      <div className={`inline-flex items-center justify-center rounded-full bg-slate-800/50 px-4 py-2 ${className}`}>
        <div className="h-4 w-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  // Force Telegram CTA to the public bot link and keep WhatsApp behavior unchanged
  const messagingURL =
    provider === 'telegram'
      ? 'https://t.me/fisi_online_bot'
      : buildWhatsAppUrl((config as { phoneNumber: string }).phoneNumber, config.message);
  const variant = config.variant;

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 100);
  };

  const defaultLabel =
    config.label ||
    (provider === 'telegram' ? 'Chat on Telegram' : 'Get started on WhatsApp');
  const defaultDescription =
    config.description ||
    (provider === 'telegram'
      ? 'Chat with us directly on Telegram'
      : 'Chat with us directly on WhatsApp');

  if (variant === 'banner') {
    if (provider === 'telegram') {
      return (
        <div className={`rounded-3xl border border-blue-500/25 bg-blue-500/10 px-6 py-4 text-center ${className}`}>
          <p className="text-sm text-blue-200">💬 {defaultDescription}</p>
          <a
            href={messagingURL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            onClick={handleClick}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.48 3.36L2.8 10.18c-.95.31-.95 1.26-.05 1.57l4.06 1.49 1.5 4.66c.23.73 1.17.95 1.7.45l2.47-2.01 4.85 3.12c.82.53 1.89-.08 1.66-1.05L22.5 4.2c-.12-.64-.67-1.01-1.02-.84zM9.06 13.5l7.08-4.98-8.95 3.78 1.87 1.2z" />
            </svg>
            {defaultLabel}
          </a>
        </div>
      );
    }

    return (
      <div className={`rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-6 py-4 text-center ${className}`}>
        <p className="text-sm text-emerald-200">💬 {defaultDescription}</p>
        <a
          href={messagingURL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          onClick={handleClick}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
          </svg>
          {defaultLabel}
        </a>
      </div>
    );
  }

  if (variant === 'link') {
    if (provider === 'telegram') {
      return (
        <a
          href={messagingURL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 transition hover:border-blue-500/60 hover:bg-blue-500/20 ${className}`}
          onClick={handleClick}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
          </svg>
          {defaultLabel}
        </a>
      );
    }

    return (
      <a
        href={messagingURL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-400/60 hover:bg-emerald-400/20 ${className}`}
        onClick={handleClick}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.48 3.36L2.8 10.18c-.95.31-.95 1.26-.05 1.57l4.06 1.49 1.5 4.66c.23.73 1.17.95 1.7.45l2.47-2.01 4.85 3.12c.82.53 1.89-.08 1.66-1.05L22.5 4.2c-.12-.64-.67-1.01-1.02-.84zM9.06 13.5l7.08-4.98-8.95 3.78 1.87 1.2z" />
        </svg>
        {defaultLabel}
      </a>
    );
  }

    if (provider === 'telegram') {
    return (
      <a
        href={messagingURL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-8 py-4 text-sm font-semibold text-white transition hover:bg-blue-400 active:scale-95 ${className}`}
        onClick={handleClick}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.48 3.36L2.8 10.18c-.95.31-.95 1.26-.05 1.57l4.06 1.49 1.5 4.66c.23.73 1.17.95 1.7.45l2.47-2.01 4.85 3.12c.82.53 1.89-.08 1.66-1.05L22.5 4.2c-.12-.64-.67-1.01-1.02-.84zM9.06 13.5l7.08-4.98-8.95 3.78 1.87 1.2z" />
        </svg>
        {defaultLabel}
      </a>
    );
  }

  return (
    <a
      href={messagingURL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 active:scale-95 ${className}`}
      onClick={handleClick}
    >
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
      </svg>
      {defaultLabel}
    </a>
  );
}
