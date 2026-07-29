export type PhoneCountry = {
  code: string;
  dialCode: string;
  label: string;
};

// Small curated list, not a full ISO/dial-code database — Tanzania (the
// store's own country, see ContactPage.tsx's business number) plus a few
// commonly needed countries, including South Sudan per the original request.
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "TZ", dialCode: "+255", label: "Tanzania" },
  { code: "SS", dialCode: "+211", label: "South Sudan" },
  { code: "KE", dialCode: "+254", label: "Kenya" },
  { code: "UG", dialCode: "+256", label: "Uganda" },
  { code: "GB", dialCode: "+44", label: "United Kingdom" },
  { code: "US", dialCode: "+1", label: "United States" },
];

export const DEFAULT_PHONE_COUNTRY_CODE = "TZ";

export function findPhoneCountry(code: string): PhoneCountry {
  return (
    PHONE_COUNTRIES.find((country) => country.code === code) ??
    PHONE_COUNTRIES.find((country) => country.code === DEFAULT_PHONE_COUNTRY_CODE)!
  );
}

// Given a full phone value (e.g. "+255712345678"), find the matching country
// by longest matching dial code prefix (so "+1..." isn't mistaken by a
// shorter accidental prefix match) and split off the local number.
export function splitPhoneValue(value: string): { countryCode: string; localNumber: string } {
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => value.startsWith(country.dialCode));
  if (!match) {
    return { countryCode: DEFAULT_PHONE_COUNTRY_CODE, localNumber: value };
  }
  return { countryCode: match.code, localNumber: value.slice(match.dialCode.length) };
}
