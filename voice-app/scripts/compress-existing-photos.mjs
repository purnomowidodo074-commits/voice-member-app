/**
 * One-off: kompres ulang semua foto lama di bucket `voice-photos` secara in-place.
 * Object key tidak berubah -> voice_members.photo_url tetap valid, tanpa update DB.
 *
 * Butuh service role key (anon tidak punya izin UPDATE object storage):
 *
 *   node scripts/compress-existing-photos.mjs <SERVICE_ROLE_KEY>
 *   node scripts/compress-existing-photos.mjs --dry <SERVICE_ROLE_KEY>
 *
 * Atau lewat env: SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/compress-existing-photos.mjs
 * URL project dibaca dari .env.local (NEXT_PUBLIC_SUPABASE_URL) atau env SUPABASE_URL.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "voice-photos";
const MAX_DIM = 1600;
const QUALITY = 75;
const SKIP_BELOW = 400 * 1024; // sudah kecil -> lewati
const DRY = process.argv.includes("--dry");

function readEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

const env = readEnvLocal();
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.argv.slice(2).find((a) => /^(eyJ|sb_secret_)/.test(a));

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Butuh SUPABASE_URL (atau .env.local) + SUPABASE_SERVICE_ROLE_KEY di environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const fmt = (n) => `${(n / 1024).toFixed(0)} kB`;

async function listAll() {
  const files = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    files.push(...data.filter((f) => f.id)); // buang folder placeholder
    if (data.length < pageSize) break;
  }
  return files;
}

const files = await listAll();
console.log(`${files.length} objek di ${BUCKET}${DRY ? " (DRY RUN)" : ""}\n`);

let before = 0;
let after = 0;
let changed = 0;
let skipped = 0;
let failed = 0;

for (const f of files) {
  const size = Number(f.metadata?.size ?? 0);
  before += size;

  if (size && size < SKIP_BELOW) {
    after += size;
    skipped++;
    continue;
  }

  try {
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(f.name);
    if (dlErr) throw dlErr;
    const input = Buffer.from(await blob.arrayBuffer());

    const out = await sharp(input)
      .rotate() // hormati EXIF orientation
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    if (out.length >= input.length) {
      after += input.length;
      skipped++;
      console.log(`=  ${f.name}  ${fmt(input.length)} (tidak lebih kecil, lewati)`);
      continue;
    }

    after += out.length;
    changed++;
    console.log(`v  ${f.name}  ${fmt(input.length)} -> ${fmt(out.length)}`);

    if (!DRY) {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(f.name, out, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
    }
  } catch (e) {
    failed++;
    after += size;
    console.log(`x  ${f.name}  ${e.message ?? e}`);
  }
}

console.log(
  `\nselesai: ${changed} dikompres, ${skipped} dilewati, ${failed} gagal` +
    `\ntotal ${fmt(before)} -> ${fmt(after)}` +
    (DRY ? "\n(DRY RUN - tidak ada yang ditulis)" : "")
);
