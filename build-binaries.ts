import { $ } from 'bun'
import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises'

// Bridge entrypoint: `tools/ollama-bridge/serve.ts` in the monorepo, or root
// `serve.ts` in the standalone public repo (override via J4T_BRIDGE_SERVE).
const SERVE = process.env.J4T_BRIDGE_SERVE ?? 'serve.ts'
const VERSION = process.env.J4T_BRIDGE_VERSION ?? '1.0.3'
const OUT = 'dist-bridge'
const STAGE = `${OUT}/.stage`
const BIN = 'j4t-ollama-bridge'
const APP = 'j4t Ollama Bridge.app'
const VOLNAME = 'j4t Ollama Bridge'

// macOS one-click: a real .app bundle. Double-clicking it runs the bridge (no
// terminal, no extensionless file). The launcher clears the Gatekeeper
// quarantine on the unsigned binary, posts a "running" notification, and execs
// it; the app stays in the Dock so the user can Quit it to stop the bridge.
const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>j4t Ollama Bridge</string>
  <key>CFBundleDisplayName</key><string>j4t Ollama Bridge</string>
  <key>CFBundleIdentifier</key><string>at.job4talents.ollama-bridge</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`

const APP_LAUNCHER = `#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/../Resources/${BIN}"
xattr -dr com.apple.quarantine "$BIN" 2>/dev/null || true
chmod +x "$BIN"
osascript -e 'display notification "Local AI is ready. Quit this app from the Dock to stop." with title "j4t Ollama Bridge"' 2>/dev/null || true
exec "$BIN"
`

const LINUX_LAUNCHER = `#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/${BIN}"
chmod +x "$BIN"
echo "j4t Ollama Bridge is running on http://127.0.0.1:11435 (press Ctrl-C to stop)"
exec "$BIN"
`

const targets = [
  { target: 'bun-darwin-arm64', pkg: 'macos-arm64', kind: 'mac' },
  { target: 'bun-darwin-x64', pkg: 'macos-x64', kind: 'mac' },
  { target: 'bun-windows-x64', pkg: 'windows-x64', kind: 'win' },
  { target: 'bun-linux-x64', pkg: 'linux-x64', kind: 'linux' },
] as const

const only = process.argv[2] // optional target substring to build just one

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

for (const { target, pkg, kind } of targets) {
  if (only && !target.includes(only)) continue
  // Version-stamp the artifact name so downloads are self-identifying and a new
  // release never collides with a cached older asset of the same name.
  const dirName = `${BIN}-v${VERSION}-${pkg}`
  const stage = `${STAGE}/${pkg}`
  await mkdir(stage, { recursive: true })
  console.log(`Building ${pkg}…`)

  if (kind === 'mac') {
    const root = `${stage}/dmg`
    const appDir = `${root}/${APP}`
    await mkdir(`${appDir}/Contents/MacOS`, { recursive: true })
    await mkdir(`${appDir}/Contents/Resources`, { recursive: true })
    await $`bun build ${SERVE} --compile --target=${target} --outfile ${appDir}/Contents/Resources/${BIN}`
    await writeFile(`${appDir}/Contents/Info.plist`, INFO_PLIST)
    await writeFile(`${appDir}/Contents/MacOS/launcher`, APP_LAUNCHER)
    await chmod(`${appDir}/Contents/MacOS/launcher`, 0o755)
    await chmod(`${appDir}/Contents/Resources/${BIN}`, 0o755)
    // Ad-hoc sign the bundle so macOS shows a bypassable "unidentified developer"
    // prompt instead of refusing it as "damaged" (which a fully unsigned bundle is).
    await $`codesign --force --deep --sign - ${appDir}`
    // Drag-to-install disk image: the app shown next to an Applications shortcut.
    await $`ln -s /Applications ${root}/Applications`
    await $`hdiutil create -volname ${VOLNAME} -srcfolder ${root} -ov -format UDZO ${OUT}/${dirName}.dmg`
  } else if (kind === 'win') {
    await $`bun build ${SERVE} --compile --target=${target} --outfile ${OUT}/${dirName}.exe`
  } else {
    await $`bun build ${SERVE} --compile --target=${target} --outfile ${stage}/${BIN}`
    await writeFile(`${stage}/start.sh`, LINUX_LAUNCHER)
    await chmod(`${stage}/start.sh`, 0o755)
    await chmod(`${stage}/${BIN}`, 0o755)
    await $`tar -czf ${OUT}/${dirName}.tar.gz -C ${STAGE} ${pkg}`
  }
}
await rm(STAGE, { recursive: true, force: true })
console.log(`Done. Packaged artifacts in ${OUT}/.`)
