import { MessageCircle } from 'lucide-react';
import { config } from '../config';
import { useI18n } from '../i18n/LanguageContext';

/** Floating customer-service chat link. Hidden when no number is configured. */
export default function WhatsAppButton() {
  const { lang } = useI18n();
  if (!config.whatsappNumber) return null;
  const text = encodeURIComponent(
    lang === 'de' ? 'Hallo Earthveda! Ich habe eine Frage.' : 'Hi Earthveda! I have a question.',
  );
  return (
    <a
      className="wa-fab"
      href={`https://wa.me/${config.whatsappNumber}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        lang === 'de'
          ? 'WhatsApp Chat öffnen (neuer Tab)'
          : 'Chat with us on WhatsApp (opens in a new tab)'
      }
    >
      <MessageCircle size={22} aria-hidden="true" />
      <span>{lang === 'de' ? 'Chat' : 'Chat with us'}</span>
    </a>
  );
}
