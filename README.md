# SMB Mounter

SMB Mounter is a macOS Electron utility for managing saved SMB shares. It lets you import existing system SMB mounts, mount or unmount saved shares, open mounted shares in Finder, retry disconnected shares, and manage startup/notification settings from a compact menu-bar-style UI.

## Features

- Compact share console with mounted/error/auto-retry summary
- Add, edit, delete, import, mount, unmount, retry, and open SMB shares
- Finder fallback for macOS system-managed SMB automount paths under `/System/Volumes/Data/mnt/SMB`
- Encrypted password storage for saved shares
- Launch-at-login and notification settings
- Chinese and English UI

## Development

Install dependencies:

```bash
npm install
```

Start the Electron app in development mode:

```bash
npm run dev
```

Run verification:

```bash
npm test
npm run typecheck
npm run build
```

## Packaging

Create distributable macOS artifacts:

```bash
npm run dist
```

Generated artifacts are written to `release/` and are intentionally ignored by git. The default build uses ad-hoc macOS signing and is suitable for local testing; notarization is not configured.

## Project Structure

- `src/main/`: Electron main process, tray, IPC, startup integration
- `src/preload/`: secure renderer bridge
- `src/core/`: SMB, mount, config, crypto, and monitoring logic
- `src/renderer/`: React UI, hooks, i18n, styles
- `src/types/`: shared application types
- `assets/` and `build/`: icon assets and macOS entitlements
- `test/`: Node test runner coverage for core helpers and presentation logic

## Notes

`release/`, `out/`, `out-test/`, `.superpowers/`, and local credentials/config are not committed. Local app configuration is stored under `~/.smb-mounter/`.
