import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LANGUAGES, type Language } from "@es-market/core";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import sw from "./locales/sw.json";
import fr from "./locales/fr.json";

const STORAGE_KEY = "language";

function isLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value);
}

function applyDocumentLanguage(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
}

const stored = window.localStorage.getItem(STORAGE_KEY);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    sw: { translation: sw },
    fr: { translation: fr },
  },
  lng: isLanguage(stored) ? stored : "en",
  fallbackLng: "en",
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language);

i18n.on("languageChanged", (lng) => {
  window.localStorage.setItem(STORAGE_KEY, lng);
  applyDocumentLanguage(lng);
});

export default i18n;
