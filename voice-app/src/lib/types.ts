export interface VoiceMember {
  id: string;
  created_at: string;
  input_date: string;
  member_name: string;
  line_name: string;
  voice_text: string;
  photo_url: string | null;
}

export const LINE_OPTIONS = [
  "Mel-Pour-Analys",
  "Mould-RCS",
  "Core Making",
  "Finishing",
  "Maintenance",
] as const;

export type LineName = (typeof LINE_OPTIONS)[number];
