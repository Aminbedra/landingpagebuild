#!/usr/bin/env node
// One-off bootstrap for a fresh super_admin account on the STAGING
// environment, for when there's no existing admin session to use
// POST /api/admin/users through. Mirrors exactly what that route does
// (routes/adminUsers.ts) — same id/timestamp shape, same password hash
// (lib/auth.ts's hashPassword: SHA-256(password + lowercased email)) —
// just run directly against D1 + KV via wrangler since there's no admin
// JWT yet to call the API with.
//
// Run this yourself from worker/: `node scripts/bootstrap-admin.mjs`
// It prompts for email and password locally (password input is not
// echoed to the terminal, and must be typed twice to catch typos — a
// mistyped password with no confirmation was the bug in the first version
// of this script) and never sends either anywhere except into the
// wrangler commands below, run on your own machine. Nothing is logged.
//
// Requires `npx wrangler login` already done for this Cloudflare account.

import { createInterface } from 'node:readline'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const DB_NAME = 'lpb-staging-db'
const SESSIONS_NAMESPACE_ID = 'd9c3135ef13a4923ad6f3eea4eef081d'

const BACKSPACE = 0x08
const DEL = 0x7f
const CTRL_C = 0x03
const ENTER_CR = 0x0d
const ENTER_LF = 0x0a

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close()
    resolve(answer)
  }))
}

// Hides input while typing, like a normal password prompt. Uses raw byte
// codes (not string literal comparisons) for control characters — a prior
// version compared against literal characters that got mangled when this
// file was written, silently breaking backspace.
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    stdin.resume()
    stdin.setRawMode(true)
    let value = ''
    const onData = (buf) => {
      for (const byte of buf) {
        if (byte === ENTER_CR || byte === ENTER_LF) {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (byte === CTRL_C) {
          process.stdout.write('\n')
          process.exit(1)
        }
        if (byte === BACKSPACE || byte === DEL) {
          value = value.slice(0, -1)
          continue
        }
        value += String.fromCharCode(byte)
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const email = (await ask('Admin email: ')).trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  let password
  while (true) {
    password = await askHidden('Admin password (hidden, min 8 chars): ')
    if (!password || password.length < 8) {
      console.log('Password must be at least 8 characters. Try again.\n')
      continue
    }
    const confirm = await askHidden('Confirm password: ')
    if (confirm !== password) {
      console.log("Passwords didn't match. Try again.\n")
      continue
    }
    break
  }

  const name = (await ask('Name (optional): ')).trim() || null

  const timestamp = new Date().toISOString()
  const passwordHash = createHash('sha256').update(password + email).digest('hex')

  // Idempotent: if this email already has a row (e.g. a prior run of this
  // script), reuse its id and just reset the password + role instead of
  // failing on the email UNIQUE constraint.
  const lookup = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', `SELECT id FROM users WHERE email = '${email}';`],
    { encoding: 'utf8' }
  )
  if (lookup.status !== 0) {
    console.error(lookup.stdout)
    console.error(lookup.stderr)
    throw new Error('D1 lookup failed — see output above')
  }
  let existingId = null
  try {
    const parsed = JSON.parse(lookup.stdout)
    existingId = parsed?.[0]?.results?.[0]?.id ?? null
  } catch {
    // Fall through — treat as no existing row.
  }

  const id = existingId ?? randomUUID()

  const d1Sql = existingId
    ? `UPDATE users SET role = 'super_admin', updated_at = '${timestamp}' WHERE id = '${id}';`
    : `INSERT INTO users (id, email, name, role, created_at, updated_at) ` +
      `VALUES ('${id}', '${email}', ${name ? `'${name.replace(/'/g, "''")}'` : 'NULL'}, 'super_admin', '${timestamp}', '${timestamp}');`

  console.log(`\n${existingId ? 'Found existing account' : 'Creating new account'} for ${email} (id ${id}) on ${DB_NAME}…`)

  const d1Result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--command', d1Sql],
    { stdio: 'inherit' }
  )
  if (d1Result.status !== 0) throw new Error('D1 write failed — see output above')

  const kvResult = spawnSync(
    'npx',
    ['wrangler', 'kv:key', 'put', '--namespace-id', SESSIONS_NAMESPACE_ID, `pw:${id}`, passwordHash],
    { stdio: 'inherit' }
  )
  if (kvResult.status !== 0) throw new Error('KV password write failed — see output above')

  console.log(`\nDone. Log in at the staging admin panel with:\n  ${email}\n  (the password you just typed)`)
}

main().catch((err) => {
  console.error(`\n${err.message}`)
  process.exit(1)
})
