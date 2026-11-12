// High Court (HC) case types, benches and proceeding outcomes.
// Kept in one place so the lists are easy to extend later.

export const HC_CASE_TYPES = [
  { code: "WP", label: "Writ Petition", prefix: "W.P." },
  { code: "OBJ", label: "Objection Case (Writ)", prefix: "Obj." },
  { code: "CR", label: "Civil Revision", prefix: "C.R." },
  { code: "RFA", label: "Regular First Appeal", prefix: "R.F.A." },
  { code: "RSA", label: "Regular Second Appeal", prefix: "R.S.A." },
  { code: "ICA", label: "Intra Court Appeal (Division Bench)", prefix: "I.C.A." },
  { code: "TR", label: "Tax Reference", prefix: "T.R." },
  { code: "CUSR", label: "Customs Reference", prefix: "Cus. Ref." },
  { code: "CO", label: "Company Matter", prefix: "C.O." },
  { code: "COS", label: "Banking Suit (Original Jurisdiction)", prefix: "C.O.S." },
  { code: "CRLR", label: "Criminal Revision", prefix: "Crl. Rev." },
  { code: "CRLA", label: "Criminal Appeal", prefix: "Crl. A." },
  { code: "CRLM", label: "Criminal Miscellaneous", prefix: "Crl. Misc." },
  { code: "OTH", label: "Other", prefix: "" },
] as const;

export const HC_BENCHES = ["Multan", "Lahore", "Bahawalpur", "Rawalpindi"] as const;

export function hcTypeByCode(code: string | null | undefined) {
  return HC_CASE_TYPES.find(t => t.code === code);
}

// e.g. "W.P. No. 13485/2026"
export function formatHcCaseNumber(code: string, no: string, year: number | string): string {
  const t = hcTypeByCode(code);
  const prefix = t?.prefix ? `${t.prefix} No.` : "No.";
  return `${prefix} ${no.trim()}/${year}`;
}

export const PROCEEDING_OUTCOMES = [
  { value: "adjourned", label: "Adjourned", closes: false },
  { value: "notice_issued", label: "Notice issued", closes: false },
  { value: "interim_relief", label: "Interim relief / stay granted", closes: false },
  { value: "admitted", label: "Admitted / leave granted", closes: false },
  { value: "fixed_for_arguments", label: "Fixed for arguments", closes: false },
  { value: "cm_order", label: "C.M. / order passed", closes: false },
  { value: "judgment_reserved", label: "Judgment reserved", closes: false },
  { value: "allowed", label: "Allowed", closes: true },
  { value: "disposed", label: "Disposed of", closes: true },
  { value: "dismissed", label: "Dismissed", closes: true },
  { value: "dismissed_non_prosecution", label: "Dismissed for non-prosecution", closes: true },
  { value: "withdrawn", label: "Withdrawn", closes: true },
  { value: "dismissed_as_withdrawn", label: "Dismissed as withdrawn", closes: true },
  { value: "other", label: "Other", closes: false },
] as const;

export function outcomeInfo(value: string) {
  return PROCEEDING_OUTCOMES.find(o => o.value === value);
}
