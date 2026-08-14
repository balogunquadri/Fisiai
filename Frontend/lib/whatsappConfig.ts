/**
 * WhatsApp CTA Configuration
 * Supports environment variables, merchant config, and dynamic variants
 */

export interface WhatsAppCTAConfig {
  phoneNumber: string;
  message: string;
  variant: 'button' | 'link' | 'banner';
  label?: string;
  description?: string;
}

export interface WhatsAppCTAVariant {
  name: string;
  message: string;
  variant: 'button' | 'link' | 'banner';
  label?: string;
  description?: string;
}

export interface TelegramCTAConfig {
  botUsername: string;
  message: string;
  variant: 'button' | 'link' | 'banner';
  label?: string;
  description?: string;
}

export interface TelegramCTAVariant {
  name: string;
  message: string;
  variant: 'button' | 'link' | 'banner';
  label?: string;
  description?: string;
}

export type MessagingProvider = 'whatsapp' | 'telegram';

/**
 * Default WhatsApp CTA configurations per page/context
 */
export const whatsappCtaVariants: Record<string, WhatsAppCTAVariant> = {
  homepage: {
    name: 'homepage',
    message: 'Hi! I want to ask Fisi AI about inventory, receipts, payments, or stock updates.',
    variant: 'button',
    label: 'Ask Fisi AI on WhatsApp',
    description: 'Chat with Fisi AI on WhatsApp for inventory and payment help.',
  },
  signupFlow: {
    name: 'signupFlow',
    message: 'Hi! I just signed up and want to connect my WhatsApp Business account',
    variant: 'banner',
    label: 'Start WhatsApp Chat',
    description: 'Connect your business account now',
  },
  onboarding: {
    name: 'onboarding',
    message: 'Help me set up my inventory and contacts on Fisi Ai',
    variant: 'button',
    label: 'Get onboarding support',
    description: 'Chat with our setup team',
  },
  dashboard: {
    name: 'dashboard',
    message: 'I need support with my Fisi Ai dashboard',
    variant: 'link',
    label: 'Chat with support',
    description: '',
  },
  inventory: {
    name: 'inventory',
    message: 'How do I optimize my inventory with Fisi Ai?',
    variant: 'link',
    label: 'Ask about inventory',
  },
  sales: {
    name: 'sales',
    message: 'Show me how Fisi Ai can boost my sales',
    variant: 'link',
    label: 'Sales inquiry',
  },
  support: {
    name: 'support',
    message: 'I need technical support for Fisi Ai',
    variant: 'banner',
    label: 'Get support now',
    description: 'Our team is ready to help',
  },
};

export const telegramCtaVariants: Record<string, TelegramCTAVariant> = {
  homepage: {
    name: 'homepage',
    message: 'Hi! I want to ask Fisi AI about inventory, receipts, payments, or stock updates.',
    variant: 'button',
    label: 'Ask Fisi AI on Telegram',
    description: 'Chat with Fisi AI on Telegram for inventory and payment help.',
  },
  signupFlow: {
    name: 'signupFlow',
    message: 'Hi! I just signed up and want to connect my Telegram account',
    variant: 'banner',
    label: 'Start Telegram Chat',
    description: 'Connect your business account now',
  },
  onboarding: {
    name: 'onboarding',
    message: 'Help me set up my inventory and contacts on Fisi Ai',
    variant: 'button',
    label: 'Get onboarding support',
    description: 'Chat with our setup team',
  },
  dashboard: {
    name: 'dashboard',
    message: 'I need support with my Fisi Ai dashboard',
    variant: 'link',
    label: 'Chat with support',
    description: '',
  },
  inventory: {
    name: 'inventory',
    message: 'How do I optimize my inventory with Fisi Ai?',
    variant: 'link',
    label: 'Ask about inventory',
  },
  sales: {
    name: 'sales',
    message: 'Show me how Fisi Ai can boost my sales',
    variant: 'link',
    label: 'Sales inquiry',
  },
  support: {
    name: 'support',
    message: 'I need technical support for Fisi Ai',
    variant: 'banner',
    label: 'Get support now',
    description: 'Our team is ready to help',
  },
};

/**
 * Get WhatsApp business phone from environment or config
 */
export function getBusinessPhoneNumber(merchantPhone?: string): string {
  // Priority order:
  // 1. Merchant-specific WhatsApp Business phone (from config/API)
  // 2. Environment variable NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE
  // 3. Fallback support number

  if (merchantPhone) {
    return merchantPhone;
  }

  return (
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_PHONE ||
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE ||
    '++2347086024885' // Fallback
  );
}

/**
 * Get WhatsApp CTA config for a specific page/variant
 */
export function getWhatsAppCTAConfig(
  variantName: string,
  overrides?: Partial<WhatsAppCTAConfig> & { phoneNumber?: string }
): WhatsAppCTAConfig {
  const variantConfig = whatsappCtaVariants[variantName] || whatsappCtaVariants.homepage;
  const phoneNumber = overrides?.phoneNumber || getBusinessPhoneNumber();

  return {
    phoneNumber,
    message: overrides?.message || variantConfig.message,
    variant: overrides?.variant || variantConfig.variant,
    label: overrides?.label || variantConfig.label,
    description: overrides?.description || variantConfig.description,
  };
}

export function getTelegramCTAConfig(
  variantName: string,
  overrides?: Partial<TelegramCTAConfig> & { botUsername?: string }
): TelegramCTAConfig {
  const variantConfig = telegramCtaVariants[variantName] || telegramCtaVariants.homepage;
  const botUsername = overrides?.botUsername || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'fisi_online_bot';

  return {
    botUsername,
    message: overrides?.message || variantConfig.message,
    variant: overrides?.variant || variantConfig.variant,
    label: overrides?.label || variantConfig.label,
    description: overrides?.description || variantConfig.description,
  };
}

/**
 * Build WhatsApp URL with phone and prefilled message
 */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function buildTelegramUrl(botUsername: string, message: string): string {
  const username = botUsername.replace(/^@/, '');
  const encoded = encodeURIComponent(message || '');
  return encoded
    ? `https://t.me/${username}?start=${encoded}`
    : `https://t.me/${username}`;
}

/**
 * Fetch merchant-specific WhatsApp config from backend
 */
export async function fetchMerchantWhatsAppConfig(merchantId: string): Promise<{
  businessPhoneNumber: string;
  businessName: string;
  phoneNumberId?: string;
} | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/dashboard/${merchantId}/whatsapp-config`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function fetchMerchantTelegramConfig(merchantId: string): Promise<{
  botUsername: string;
  chatId?: string | null;
  deepLink?: string;
  botConfigured: boolean;
} | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/dashboard/${merchantId}/telegram-config`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
