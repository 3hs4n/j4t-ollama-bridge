import { $ } from 'bun'

const targets = [
  { target: 'bun-darwin-arm64', out: 'j4t-ollama-bridge-macos-arm64' },
  { target: 'bun-darwin-x64', out: 'j4t-ollama-bridge-macos-x64' },
  { target: 'bun-windows-x64', out: 'j4t-ollama-bridge-windows-x64.exe' },
  { target: 'bun-linux-x64', out: 'j4t-ollama-bridge-linux-x64' },
]

const only = process.argv[2] // optional: pass a target substring to build just one

for (const { target, out } of targets) {
  if (only && !target.includes(only)) continue
  console.log(`Building ${out} (${target})...`)
  await $`bun build serve.ts --compile --target=${target} --outfile dist-bridge/${out}`
}
console.log('Done. Binaries in dist-bridge/.')
