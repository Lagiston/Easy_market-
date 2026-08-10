import { useTranslation } from "react-i18next";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  PHONE_COUNTRIES,
  findPhoneCountry,
  splitPhoneValue,
} from "@/lib/phone-countries";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PhoneInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  autoComplete?: string;
  // Let a permanently-dark page (e.g. CheckoutPage.tsx) override the default
  // widths/styling on the country Select and the number Input, same override
  // convention as Money's prefixClassName.
  selectClassName?: string;
  inputClassName?: string;
};

// Composes a country dial-code Select with a plain local-number Input,
// combining them into the single "+<dialCode><localNumber>" string the
// shared customerPhone schema already accepts — no schema/server change.
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  autoComplete,
  selectClassName,
  inputClassName,
}: PhoneInputProps) {
  const { t } = useTranslation();
  const { countryCode, localNumber } = value
    ? splitPhoneValue(value)
    : { countryCode: DEFAULT_PHONE_COUNTRY_CODE, localNumber: "" };

  function combine(nextCountryCode: string, nextLocalNumber: string) {
    const dialCode = findPhoneCountry(nextCountryCode).dialCode;
    onChange(nextLocalNumber ? `${dialCode}${nextLocalNumber}` : "");
  }

  return (
    <div className="flex gap-2">
      <Select
        value={countryCode}
        onValueChange={(next) => combine(next ?? countryCode, localNumber)}
      >
        <SelectTrigger
          id={`${id}-country`}
          aria-label={t("checkout.phoneCountry")}
          className={selectClassName ?? "shrink-0"}
        >
          <SelectValue>
            {() => findPhoneCountry(countryCode).dialCode}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {country.label} ({country.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        value={localNumber}
        onChange={(event) => combine(countryCode, event.target.value.replace(/[^0-9\s-]/g, ""))}
        onBlur={onBlur}
        className={inputClassName ?? "flex-1"}
      />
    </div>
  );
}
