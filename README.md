<p align="center">
  <img src="assets/trayConnected.png" width="64" alt="SMB Mounter" />
</p>

<h1 align="center">SMB Mounter</h1>

<p align="center">
  A macOS menu bar app to manage your SMB network shares — mount, unmount, auto-retry, and browse all from a compact window.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-000000?style=flat&logo=apple" alt="macOS" />
  <img src="https://img.shields.io/badge/built%20with-Electron-47848F?style=flat&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/styling-Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss" alt="Tailwind" />
</p>

---

## Why SMB Mounter?

macOS can mount SMB shares natively, but managing multiple shares across different servers is a pain. You either dig through Finder's "Connect to Server" dialog every time, or write shell scripts to mount them manually. If a share drops — and they do — you're back to the terminal.

**SMB Mounter** gives you a single place to save, mount, unmount, and monitor all your SMB shares. It lives in your menu bar, retries disconnected shares automatically, and keeps your credentials encrypted in the OS keychain.

---

## Features

- 🖥️ **Menu bar app** — compact tray icon with live mount status, right-click to manage
- ➕ **Add / Edit / Delete** — save your SMB shares with custom names and mount paths
- 📥 **Import existing mounts** — auto-detect currently mounted SMB shares and import them in one click
- 🔄 **Auto-retry** — automatically re-mount disconnected shares at a configurable interval
- 🔐 **Encrypted credentials** — passwords are encrypted via [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) (OS keychain) with AES-256-GCM fallback
- 📂 **Open in Finder** — one click to reveal a mounted share in Finder
- 🔍 **Share discovery** — browse SMB servers on your local network and pick shares to mount
- 🚀 **Launch at login** — optionally start automatically when you log in
- 🔔 **Notifications** — get notified on mount/unmount events
- 🌗 **Dark mode** — light, dark, and system theme support
- 🌐 **English & 中文** — fully bilingual UI
- 🩺 **Diagnostic mode** — built-in logging for troubleshooting SMB issues

---

## Screenshots

<!-- TODO: add screenshots -->
> _Screenshots coming soon. In the meantime, clone and run `npm run dev` to see it live._

---

## Installation

### Download (macOS)

Download the latest `.dmg` from the [Releases](https://github.com/blurryface1/smb-mounter/releases) page.

> The app is currently ad-hoc signed. On first launch, right-click the app in Finder and select **Open** to bypass Gatekeeper.

### Build from source

```bash
git clone https://github.com/blurryface1/smb-mounter.git
cd smb-mounter
npm install
npm run dist
```

The `.dmg` and `.zip` artifacts will be written to `release/`.

---

## Usage

1. Launch **SMB Mounter** — it appears as a tray icon in your menu bar
2. Click the tray icon to open the main window
3. Click **Add** to configure a new share:
   - **Server** — IP or hostname of your SMB server (e.g. `192.168.1.100`)
   - **Share** — the share name on the server
   - **Username / Password** — credentials for the share
   - **Mount path** — local folder where the share will be mounted (default: `/Users/Shared/SMB/<name>`)
4. Click **Mount** to connect, then **Open in Finder** to browse
5. Enable **Auto-retry** on shares that need to stay connected

You can also **Import** existing system SMB mounts — the app scans your current `mount` table and lets you pick which shares to save.

---

## Development

```bash
# Install dependencies
npm install

# Start in dev mode (hot reload)
npm run dev

# Run tests
npm test

# Type-check
npm run typecheck

# Build for production
npm run build
```

### Project Structure

```
src/
├── main/          # Electron main process, tray, IPC, startup
├── preload/       # Secure context bridge
├── core/          # SMB, mount, crypto, config, discovery, diagnostics
├── renderer/      # React UI
│   ├── components/  # SettingsWindow, MountList, MountForm, etc.
│   ├── hooks/       # useMounts, useConfig
│   └── i18n/        # Chinese & English locale strings
└── types/         # Shared TypeScript types
assets/            # Tray icons
build/             # macOS entitlements, icon.icns
test/              # Node test runner suites
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Electron |
| UI | React 18 + Tailwind CSS |
| Language | TypeScript |
| Build | electron-vite + electron-builder |
| Testing | Node test runner |
| Storage | electron-store, ~/.smb-mounter/ |
| Encryption | Electron safeStorage / AES-256-GCM |

---

## FAQ

**Q: Why not just use Finder's "Connect to Server"?**
Finder remembers recent servers but doesn't save credentials, can't auto-retry dropped mounts, and gives you no central view of all your shares.

**Q: Where are my credentials stored?**
In `~/.smb-mounter/config.json`, encrypted with the OS credential store (Keychain on macOS). If safeStorage is unavailable, falls back to AES-256-GCM with a machine-bound key.

**Q: Does it work over VPN?**
Yes — if your SMB server is reachable, SMB Mounter can mount it. Enable auto-retry for shares that may drop when the VPN reconnects.

---

## License

MIT
