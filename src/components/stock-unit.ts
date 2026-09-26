export type StockPresentation = {
  dosageForm?: string | null;
  packageSize?: string | null;
};
const normalize = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const countable: [string, RegExp][] = [
  ["TABLET", /\b(?:COMPRIMES?|TABLETS?)\b/],
  ["CAPSULE", /\b(?:GELULES?|CAPSULES?)\b/],
  ["SUPPOSITORY", /\b(?:SUPPOSITOIRES?|SUPPOSITOR(?:Y|IES))\b/],
  ["PATCH", /\b(?:PATCH(?:ES)?|DISPOSITIFS? TRANSDERMIQUES?)\b/],
  ["SACHET", /\bSACHETS?\b/],
  ["AMPOULE", /\b(?:AMPOULES?|AMPUL(?:E|ES)?)\b/],
  ["VIAL", /\bVIALS?\b/],
];

// Suggest inventory units from presentation, never from the medicine's strength.
// Callers retain an editable selection and leave quantities unchanged.
export function suggestedStockUnit(medicine: StockPresentation): string {
  const form = normalize(medicine.dosageForm);
  const pack = normalize(medicine.packageSize);
  const formUnits = countable.filter(([, pattern]) => pattern.test(form));
  if (formUnits.length > 1) return "";
  if (formUnits.length === 1) return formUnits[0]?.[0] ?? "";
  const packageUnits = countable.filter(([, pattern]) => pattern.test(pack));
  if (packageUnits.length > 1) return "";
  if (packageUnits.length === 1) return packageUnits[0]?.[0] ?? "";
  if (/\bINJECTABLE\b/.test(form) && /\bFLACONS?\b/.test(pack)) return "VIAL";
  // A package's declared volume/mass can specify stock; mg/ml in strength cannot.
  const volume = /\d\s*ML\b/.test(pack);
  const mass = /\d\s*(?:G|GR|GRAMMES?|GRAMS?)\b/.test(pack);
  if (volume && mass) return "";
  if (volume) return "ML";
  if (mass) return "G";
  if (/\b(?:GOUTTES?|DROPS?)\b/.test(form)) return "DROP";
  if (/\d\s*DOSES?\b/.test(pack)) return "DOSE";
  return "";
}
