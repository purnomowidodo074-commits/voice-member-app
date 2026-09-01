export interface VoiceMember {
  id: string;
  created_at: string;
  input_date: string;
  member_name: string;
  noreg: string;
  line_name: string;
  voice_text: string;
  photo_url: string | null;
  comment_tl_gl: string | null;
  comment_sect_h: string | null;
  comment_dept_h: string | null;
}

export const LINE_OPTIONS = [
  "Mel-Pour-Analys",
  "Mould-RCS",
  "Core Making",
  "Finishing",
  "Maintenance",
] as const;

export type LineName = (typeof LINE_OPTIONS)[number];

// Umur aspirasi (hari sejak created_at) — dipakai dashboard & halaman result.
export const AGING_BUCKETS = [
  { label: "0–7 hari", maxDays: 7 },
  { label: "8–14 hari", maxDays: 14 },
  { label: "15–30 hari", maxDays: 30 },
  { label: "> 30 hari", maxDays: Infinity },
] as const;

export function agingBucketIndex(iso: string): number {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const i = AGING_BUCKETS.findIndex((b) => days <= b.maxDays);
  return i === -1 ? AGING_BUCKETS.length - 1 : i;
}
