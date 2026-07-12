import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from './locales/pt.json';
import en from './locales/en.json';

function detectLanguage(): string {
  // Escolha manual do usuário (settings) tem prioridade sobre o subdomínio
  const stored = typeof window !== 'undefined' ? localStorage.getItem('avalon_language') : null;
  if (stored === 'pt' || stored === 'en') return stored;

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.startsWith('games.')) return 'en';
  return 'pt';
}

i18n
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt }, en: { translation: en } },
    lng: detectLanguage(),
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') localStorage.setItem('avalon_language', lng);
});

export default i18n;
