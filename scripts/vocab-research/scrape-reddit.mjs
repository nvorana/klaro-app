// Reddit r/Philippines vocabulary scraper — first pass.
//
// Goal: pull conversational comments to learn what English words Filipinos
// actually use day-to-day, so KLARO content can lean on those instead of
// AI-tell words like "unlock", "delve", "robust".
//
// Pacing: ~1 request every 2.5 seconds, well under Reddit's ~60/10min limit.
// Run: node scripts/vocab-research/scrape-reddit.mjs
//
// Output: scripts/vocab-research/output/comments-raw.json (incremental)
//         scripts/vocab-research/output/word-frequencies.json
//         scripts/vocab-research/output/top-words.txt (human-readable)

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'output')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const RAW_PATH = join(OUT_DIR, 'comments-raw.json')
const FREQ_PATH = join(OUT_DIR, 'word-frequencies.json')
const TOP_PATH = join(OUT_DIR, 'top-words.txt')

const UA = 'KlaroVocabResearch/1.0 (research; contact jon@negosyouniversity.com)'
const DELAY_MS = 2500

// Subreddits to sample — broader demographic spread, day-to-day topics.
// r/Philippines alone skewed political; these add work, money, school, life.
const SUBREDDITS = [
  'Philippines',
  'AskPH',
  'CasualPH',
  'buhaydigital',
  'studentsph',
  'adultingph',
  'peyups',
]

// Listings to sample per sub.
const LISTINGS = [
  { sort: 'hot', t: '' },
  { sort: 'top', t: 'month' },
]

const POSTS_PER_LISTING = 12  // 12 × 2 listings × 7 subs = ~168 posts max

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function getPostIds() {
  // Map of postId → subreddit (we need the sub for the comments URL).
  const idToSub = new Map()
  for (const sub of SUBREDDITS) {
    for (const { sort, t } of LISTINGS) {
      const url = t
        ? `https://www.reddit.com/r/${sub}/${sort}.json?t=${t}&limit=${POSTS_PER_LISTING}`
        : `https://www.reddit.com/r/${sub}/${sort}.json?limit=${POSTS_PER_LISTING}`
      try {
        const data = await fetchJson(url)
        for (const child of data.data.children) {
          if (child.data.id && !child.data.stickied) idToSub.set(child.data.id, sub)
        }
        console.log(`[listing] r/${sub} ${sort}/${t || 'now'} → ${data.data.children.length} posts`)
      } catch (err) {
        console.warn(`[listing-fail] r/${sub} ${sort}/${t}: ${err.message}`)
      }
      await sleep(DELAY_MS)
    }
  }
  return idToSub
}

function extractComments(thing, out) {
  if (!thing) return
  if (Array.isArray(thing)) { thing.forEach(t => extractComments(t, out)); return }
  if (thing.kind === 'Listing' && thing.data?.children) {
    thing.data.children.forEach(c => extractComments(c, out))
    return
  }
  if (thing.kind === 't1' && thing.data?.body) {
    out.push(thing.data.body)
    if (thing.data.replies) extractComments(thing.data.replies, out)
  }
}

async function getCommentsForPost(postId, sub) {
  const url = `https://www.reddit.com/r/${sub}/comments/${postId}.json?limit=100&depth=3`
  const data = await fetchJson(url)
  const out = []
  extractComments(data, out)
  return out
}

async function run() {
  console.log('=== Reddit r/Philippines vocab scraper — first pass ===')
  console.log(`Pacing: ${DELAY_MS}ms between requests`)
  console.log(`Target: ~${POSTS_PER_LISTING * LISTINGS.length} posts\n`)

  // Resume support — if comments-raw.json exists, skip already-scraped post IDs.
  let existing = { posts: {}, started: new Date().toISOString() }
  if (existsSync(RAW_PATH)) {
    existing = JSON.parse(readFileSync(RAW_PATH, 'utf8'))
    console.log(`[resume] Already have ${Object.keys(existing.posts).length} posts cached.\n`)
  }

  const idToSub = await getPostIds()
  const ids = [...idToSub.keys()]
  console.log(`\n[posts] Got ${ids.length} unique post IDs across ${SUBREDDITS.length} subs.\n`)

  let totalComments = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const sub = idToSub.get(id)
    if (existing.posts[id]) {
      console.log(`[${i + 1}/${ids.length}] ${id} cached, skipping`)
      totalComments += existing.posts[id].length
      continue
    }
    try {
      const comments = await getCommentsForPost(id, sub)
      existing.posts[id] = comments
      totalComments += comments.length
      console.log(`[${i + 1}/${ids.length}] ${id} → ${comments.length} comments (total ${totalComments})`)
      // Persist after each post so a rate-limit doesn't lose progress.
      writeFileSync(RAW_PATH, JSON.stringify(existing, null, 2))
    } catch (err) {
      console.warn(`[${i + 1}/${ids.length}] ${id} FAILED: ${err.message}`)
      if (err.message.startsWith('429')) {
        console.warn('Rate limited — stopping here. Re-run later to resume.')
        break
      }
    }
    await sleep(DELAY_MS)
  }

  console.log(`\n[done] ${Object.keys(existing.posts).length} posts, ${totalComments} comments cached.`)
  console.log(`Run: node scripts/vocab-research/analyze.mjs  to build frequency list.`)
}

run().catch(err => { console.error(err); process.exit(1) })
