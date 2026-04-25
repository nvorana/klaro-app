// Analyze cached r/Philippines comments — build frequency list of English words.
//
// Reads:  output/comments-raw.json
// Writes: output/word-frequencies.json
//         output/top-words.txt

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW = join(__dirname, 'output', 'comments-raw.json')
const FREQ = join(__dirname, 'output', 'word-frequencies.json')
const TOP = join(__dirname, 'output', 'top-words.txt')
const DICT = join(__dirname, 'output', 'english-dictionary.txt')
const DICT_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt'

async function loadDictionary() {
  if (!existsSync(DICT)) {
    console.log('Downloading English dictionary (one-time, ~4MB)…')
    const res = await fetch(DICT_URL)
    if (!res.ok) throw new Error(`Failed to fetch dictionary: ${res.status}`)
    const text = await res.text()
    writeFileSync(DICT, text)
    console.log('Cached to', DICT)
  }
  const words = new Set(readFileSync(DICT, 'utf8').split(/\s+/).filter(Boolean))
  console.log(`Dictionary loaded: ${words.size} English words`)
  return words
}

if (!existsSync(RAW)) {
  console.error('No comments-raw.json found. Run scrape-reddit.mjs first.')
  process.exit(1)
}

// English stopwords + very-common Tagalog filler we want to exclude from the
// "natural English vocabulary Filipinos use" list. Tagalog is a separate study.
const STOPWORDS = new Set([
  // English common
  'the','a','an','and','or','but','if','then','so','because','of','in','on','at',
  'to','for','from','with','by','as','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'can','i','me','my','mine','we','us','our','ours','you','your','yours','he','him',
  'his','she','her','hers','it','its','they','them','their','theirs','this','that',
  'these','those','what','which','who','whom','where','when','why','how','all',
  'any','both','each','few','more','most','other','some','such','no','nor','not',
  'only','own','same','too','very','just','than','also','here','there','now','one',
  'two','about','into','out','up','down','over','under','again','still','really',
  'much','many','get','got','go','going','goes','went','make','made','see','saw',
  'know','knew','think','thought','say','said','want','wanted','need','needed',
  'like','well','yeah','yes','okay','ok','ah','oh','hmm','lol','lmao','haha',
  'na','rin','din','lang','nga','po','opo','ako','ikaw','siya','kami','tayo','kayo',
  'sila','ang','ng','sa','mga','at','kasi','dahil','pero','kung','para','yung',
  'yan','yon','ito','ano','sino','saan','kailan','paano','bakit','wala','meron',
  'nila','niya','nya','sya','npa','hindi','naman','talaga','kaya','kahit','tapos',
  'mas','pag','sana','walang','daw','nung','mag','parang','yun','ngayon','ganun',
  'ganon','gano','ganyan','ganito','marami','konti','syempre','siguro','baka',
  'pwede','puwede','dapat','gusto','ayaw','meron','mayroon','bigla','kanina',
  'mamaya','bukas','kahapon','nakaka','sobra','grabe','bagay','iba','iyan','iyon',
  'eto','etong','itong','nyan','nyo','nyong','nito','niyan','niyon','niya\'y',
  'ako\'y','akin','iyo','kanya','kanyang','natin','namin','ninyo','ating','aming',
  'mo\'y','ko\'y','sya\'y','ako\'y','ka\'y','ba','ay','sila\'y','ngayon\'y',
  'pinaka','tska','tsaka','tska','sakto','medyo','medjo','kala','akala','sabi',
  'sasabihin','sinabi','tatay','nanay','kuya','ate','lola','lolo','tito','tita',
  'pinoy','filipino','pilipino','pilipinas','philippines','manila','cebu','quezon',
  // Tagalog homonyms that pass the English dictionary check but are Tagalog in
  // this corpus (e.g. "nag" the verb to pester vs. Tagalog "nag-" prefix).
  'nag','nasa','ung','pala','tao','wag','lalo','dun','pang','kay','basta','agad',
  'yang','pinas','bahay','kong','tas','naging','dont','bago','noon','tama','ata',
  'mahal','nun','loob','bam','may','kong','dyan','dito','don','niyo','niya',
  'kanila','kanya','kasama','kahit','para','bilang','pala','iba','ibig','iyong',
  'akin','iyo','pati','sila','kami','tayo','kapag','kapwa','baka','bakit',
  // Reddit politics noise from this snapshot — not vocabulary
  'duterte','marcos','bbm','bongbong','dds','kakampink','dilawan','yellowtard',
  'davao','afp','pnp','dnd','psa','npa','nbi','dswd','doh','boc','bir',
  // Reddit / web junk
  'http','https','www','com','reddit','edit','deleted','removed','op','tldr','imo',
  'tbh','idk','iirc','afaik','etc','eg','ie',
])

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')         // strip URLs
    .replace(/\/?[ru]\/[a-z0-9_-]+/gi, ' ')   // strip /r/sub /u/user
    .replace(/[^a-z'\s-]/g, ' ')              // keep letters, apostrophes, hyphens
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 20)
    .filter(w => !/^['-]/.test(w))
    .filter(w => !STOPWORDS.has(w))
}

const dict = await loadDictionary()

// Bot/automod boilerplate detector — these comments appear on nearly every
// post and would otherwise flood the top of our list with mod-speak.
const BOT_PATTERNS = [
  /i am a bot/i,
  /performed automatically/i,
  /this is an automated/i,
  /please contact the moderators/i,
  /please contact the mods/i,
  /your post was removed/i,
  /your comment was removed/i,
  /this action was performed/i,
  /^bot beep boop/i,
  /automoderator/i,
]
function isBotComment(body) {
  return BOT_PATTERNS.some(rx => rx.test(body))
}

const raw = JSON.parse(readFileSync(RAW, 'utf8'))
const freq = new Map()
let totalComments = 0
let totalTokens = 0
let droppedNonEnglish = 0
let droppedBotComments = 0

for (const [, comments] of Object.entries(raw.posts)) {
  for (const body of comments) {
    if (isBotComment(body)) { droppedBotComments++; continue }
    totalComments++
    for (const tok of tokenize(body)) {
      // English-only filter — keeps "people" but drops "lahat", "trillanes", etc.
      // Allow contractions ("don't", "it's") since the dict has them stripped:
      // we strip the apostrophe-suffix and check the base.
      const base = tok.replace(/'(s|t|d|ll|re|ve|m)$/, '')
      if (!dict.has(base)) { droppedNonEnglish++; continue }
      totalTokens++
      freq.set(tok, (freq.get(tok) ?? 0) + 1)
    }
  }
}

const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1])

console.log(`Comments analyzed:    ${totalComments}`)
console.log(`Bot comments dropped: ${droppedBotComments}`)
console.log(`English tokens kept:  ${totalTokens}`)
console.log(`Non-English dropped:  ${droppedNonEnglish}`)
console.log(`Unique words:         ${sorted.length}`)

writeFileSync(FREQ, JSON.stringify(Object.fromEntries(sorted), null, 2))

const topN = sorted.slice(0, 500)
const lines = topN.map(([w, c], i) => `${String(i + 1).padStart(4)}. ${w.padEnd(20)} ${c}`)
writeFileSync(TOP, lines.join('\n'))
console.log(`\nTop 500 words → ${TOP}`)
console.log('Top 30 preview:\n')
console.log(lines.slice(0, 30).join('\n'))
