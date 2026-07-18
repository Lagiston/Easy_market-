import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "@es-market/core";
import { GlobeIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ar: "العربية",
  sw: "Kiswahili",
  fr: "Français",
};

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as Language;

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (value) void i18n.changeLanguage(value);
      }}
    >
      <SelectTrigger aria-label={t("language.label")}>
        <GlobeIcon className="text-muted-foreground" />
        <SelectValue>
          {(value: Language) => LANGUAGE_NAMES[value] ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
