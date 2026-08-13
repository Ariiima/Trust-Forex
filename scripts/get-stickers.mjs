// Pull a Telegram sticker/emoji pack as Lottie JSON.
//   TG_TOKEN=123:abc node scripts/get-stickers.mjs <packname>
// packname = the bit after t.me/addstickers/ or t.me/addemoji/
import { gunzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const token = process.env.TG_TOKEN
const pack = process.argv[2]
if (!token || !pack) throw new Error('need TG_TOKEN env + pack name arg')

const api = (m, q) => fetch(`https://api.telegram.org/bot${token}/${m}?${q}`).then(r => r.json())

const { ok, result, description } = await api('getStickerSet', `name=${pack}`)
if (!ok) throw new Error(description)

const out = `public/emoji/${pack}`
mkdirSync(out, { recursive: true })

for (const [i, s] of result.stickers.entries()) {
  const { result: f } = await api('getFile', `file_id=${s.file_id}`)
  const buf = Buffer.from(await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`).then(r => r.arrayBuffer()))
  // .tgs is gzipped Lottie; .webm/.webp packs are saved as-is
  const tgs = f.file_path.endsWith('.tgs')
  const name = `${String(i).padStart(2, '0')}-${s.emoji || 'x'}`
  writeFileSync(`${out}/${name}${tgs ? '.json' : f.file_path.slice(f.file_path.lastIndexOf('.'))}`, tgs ? gunzipSync(buf) : buf)
  console.log(name, s.emoji ?? '')
}
console.log(`\n${result.stickers.length} → ${out}/`)
