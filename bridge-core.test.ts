import { it, expect } from 'bun:test'
import {
  isLocalhostTarget,
  parseAllowlist,
  isOriginAllowed,
  buildCorsHeaders,
} from './bridge-core'

it('accepts only localhost targets', () => {
  expect(isLocalhostTarget('http://127.0.0.1:11434')).toBe(true)
  expect(isLocalhostTarget('http://localhost:11434')).toBe(true)
  expect(isLocalhostTarget('http://evil.example.com')).toBe(false)
})

it('merges env origins onto the defaults', () => {
  expect(parseAllowlist('https://x.test, https://y.test')).toEqual([
    'https://www.job4talents.at',
    'https://job4talents.at',
    'https://www.job4talents.com',
    'https://job4talents.com',
    'https://www.job4talents.de',
    'https://job4talents.de',
    'https://www.job4talents.ch',
    'https://job4talents.ch',
    'https://x.test',
    'https://y.test',
  ])
  expect(parseAllowlist(undefined)).toEqual([
    'https://www.job4talents.at',
    'https://job4talents.at',
    'https://www.job4talents.com',
    'https://job4talents.com',
    'https://www.job4talents.de',
    'https://job4talents.de',
    'https://www.job4talents.ch',
    'https://job4talents.ch',
  ])
})

it('allows configured + any localhost origin, denies unknown', () => {
  const list = parseAllowlist(undefined)
  expect(isOriginAllowed('https://www.job4talents.at', list)).toBe(true)
  expect(isOriginAllowed('https://job4talents.com', list)).toBe(true)
  expect(isOriginAllowed('https://www.job4talents.de', list)).toBe(true)
  expect(isOriginAllowed('https://job4talents.ch', list)).toBe(true)
  expect(isOriginAllowed('http://localhost:5173', list)).toBe(true)
  expect(isOriginAllowed('https://attacker.test', list)).toBe(false)
  expect(isOriginAllowed(null, list)).toBe(false)
})

it('emits CORS + Private-Network only for allowed origins', () => {
  const list = parseAllowlist(undefined)
  const ok = buildCorsHeaders(
    'https://www.job4talents.at',
    list,
    'content-type',
  )
  expect(ok['Access-Control-Allow-Private-Network']).toBe('true')
  expect(ok['Access-Control-Allow-Origin']).toBe('https://www.job4talents.at')
  expect(ok['Access-Control-Allow-Headers']).toBe('content-type')

  // A denied origin gets neither ACAO nor the Private-Network grant, so its
  // PNA preflight fails and it cannot reach the local bridge.
  const denied = buildCorsHeaders('https://attacker.test', list, null)
  expect(denied['Access-Control-Allow-Private-Network']).toBe(undefined)
  expect(denied['Access-Control-Allow-Origin']).toBe(undefined)
  expect(denied['Access-Control-Allow-Headers']).toBe('*')
})
