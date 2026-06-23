# j4t Local Ollama Bridge

A tiny local reverse proxy that lets the **public** job4talents.at web app read your
**local** Ollama API from the browser.

## Why this exists

Browsers apply two independent gates when an HTTPS page (`https://www.job4talents.at`)
tries to read a localhost server:

1. **CORS** — Ollama's `OLLAMA_ORIGINS` can satisfy this, but it's easy to misconfigure
   (www vs non-www, env not reaching the running server).
2. **Private Network Access (PNA)** — Chrome/Edge require the response header
   `Access-Control-Allow-Private-Network: true` on the preflight. **Ollama cannot send
   this header.**

This bridge sits in front of Ollama and adds both, so the browser can read it. Because
it runs in your process (not Ollama's), it can emit the PNA header Ollama can't — which
also future-proofs you against Chrome enforcing PNA.

## Run it

```bash
bun serve.ts
```

Then in the app's AI settings the local connection works automatically (the app
auto-detects the bridge). Default listen address: `http://127.0.0.1:11435`,
forwarding to Ollama at `http://127.0.0.1:11434`.

Standalone binaries (no Bun required) are published on GitHub Releases — download,
double-click, done.

## Configuration (env vars)

| Var                  | Default                  | Purpose                                                                        |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `J4T_BRIDGE_PORT`    | `11435`                  | Port the bridge listens on (loopback only).                                    |
| `J4T_BRIDGE_TARGET`  | `http://127.0.0.1:11434` | The Ollama server to forward to. Must be localhost.                            |
| `J4T_BRIDGE_ORIGINS` | —                        | Extra allowed origins, comma-separated (added to the job4talents.at defaults). |

## Security

- Binds `127.0.0.1` only — not reachable from your network.
- Forwards **only** to a localhost target; a non-localhost target is refused at startup.
- Reflects `Access-Control-Allow-Origin` only for allowed origins (job4talents.at +
  any localhost); unknown sites get no allow-origin, so they cannot read your local
  Ollama through the bridge. Worst case is no worse than a site reaching Ollama directly.
- No request or response bodies are ever logged.

## Known limitation (unsigned binaries)

The released binaries are not yet code-signed/notarized. First run:

- **macOS:** right-click the app → **Open** (or `xattr -d com.apple.quarantine <file>`).
- **Windows:** "More info" → "Run anyway" on the SmartScreen prompt.

Signing is a planned follow-up.
