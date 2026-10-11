/**
 * The currency prices show in on the booking sites we link to, from the country of the
 * family's home airport. Countries we don't list, or no home airport, fall back to pounds
 * (most families here are in the UK) and US dollars respectively.
 */
export const DEFAULT_CURRENCY = "GBP";
const FALLBACK = "USD";

const EURO = "AT BE BG HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK GP MQ GF RE YT PM BL MF AX";
const DOLLAR = "US EC SV PA PR GU VI AS MP TL BQ FM MH PW";

const BY_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(EURO.split(" ").map((c) => [c, "EUR"])),
  ...Object.fromEntries(DOLLAR.split(" ").map((c) => [c, "USD"])),
  GB: "GBP", IM: "GBP", JE: "GBP", GG: "GBP", GI: "GBP",
  CA: "CAD", AU: "AUD", NZ: "NZD", CH: "CHF", LI: "CHF",
  NO: "NOK", SE: "SEK", DK: "DKK", FO: "DKK", GL: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", RS: "RSD", TR: "TRY", UA: "UAH",
  JP: "JPY", CN: "CNY", HK: "HKD", MO: "HKD", TW: "TWD", KR: "KRW", SG: "SGD",
  IN: "INR", TH: "THB", MY: "MYR", ID: "IDR", PH: "PHP", VN: "VND",
  AE: "AED", SA: "SAR", QA: "QAR", IL: "ILS", EG: "EGP", MA: "MAD",
  ZA: "ZAR", KE: "KES", NG: "NGN",
  MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
};

export function currencyFor(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  return BY_COUNTRY[countryCode.toUpperCase()] ?? FALLBACK;
}
