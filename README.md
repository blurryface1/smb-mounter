# SMB Mounter

SMB Mounter is a macOS Electron utility for managing saved SMB shares. It lets you import existing system SMB mounts, mount or unmount saved shares, open mounted shares in Finder, retry disconnected shares, and manage startup/notification settings from a compact menu-bar-style UI.

## Features

- Compact share console with mounted/error/auto-retry summary
- Add, edit, delete, import, mount, unmount, retry, and open SMB shares
- Finder fallback for macOS system-managed SMB automount paths under `/System/Volumes/Data/mnt/SMB`
- macOS credential-storage-backed passwords with read compatibility for legacy encrypted entries
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
npm run audit
```

## Packaging

Create distributable macOS artifacts:

```bash
npm run dist
```

Create a universal build for both Apple Silicon and Intel Macs:

```bash
npm run dist:universal
```

Generated artifacts are written to `release/` and are intentionally ignored by git. Local builds remain unsigned when no signing identity is available. Public releases require a Developer ID Application certificate and Apple notarization credentials.

## Project Structure

- `src/main/`: Electron main process, tray, IPC, startup integration
- `src/preload/`: secure renderer bridge
- `src/core/`: SMB, mount, config, crypto, and monitoring logic
- `src/renderer/`: React UI, hooks, i18n, styles
- `src/types/`: shared application types
- `assets/` and `build/`: icon assets and macOS entitlements
- `test/`: Node test runner coverage for core helpers and presentation logic

## Notes

`release/`, `out/`, `out-test/`, `.superpowers/`, and local credentials/config are not committed. Local app configuration is stored under `~/.smb-mounter/`; its configuration and diagnostic log files are restricted to the current user.

## License

This project is available under the [MIT License](LICENSE).
