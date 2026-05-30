# Developer Mode Logging Design

## Goal

Add a developer mode that can be enabled from settings. When enabled, SMB Mounter records diagnostic logs to a local file and exposes an in-app action to open that log file in Finder. The feature is for troubleshooting mount, retry, refresh, and macOS system automount behavior without requiring a terminal.

## Scope

- Add a persisted `developerMode` setting, defaulting to `false`.
- Add a settings panel toggle for developer mode.
- Add a settings panel action to open the log file in Finder.
- Write logs only when developer mode is enabled.
- Keep logs local under the app config directory, using `~/.smb-mounter/logs/app.log`.
- Record diagnostic events around mount lifecycle operations and system automount activation.
- Do not log passwords, encrypted credentials, SMB URLs with passwords, or arbitrary file contents.

## Architecture

Create a small main-process logger module in `src/core/developerLogger.ts`. It will own log path creation, setting checks, redaction, and append-only writes. Core modules can call it without knowing where the file lives.

The renderer will not write logs directly. It will use IPC for two actions:

- `get-log-file-info`: returns the path and whether the file exists.
- `open-log-file`: opens the log file in Finder, creating the parent directory and an empty file if needed.

Settings will remain the source of truth for whether logging is enabled.

## Data Flow

1. User enables developer mode in settings.
2. `updateSettings({ developerMode: true })` persists it to `~/.smb-mounter/config.json`.
3. Mount-related core code calls `developerLog(...)`.
4. The logger checks the current setting before writing.
5. Each log line is newline-delimited JSON with timestamp, level, event name, and structured metadata.
6. User clicks "Open Log File" in settings.
7. Main process opens `~/.smb-mounter/logs/app.log` through Electron shell/Finder.

## Log Events

Initial coverage:

- `mount.start`
- `mount.alreadyActive`
- `mount.systemAutomount.start`
- `mount.systemAutomount.result`
- `mount.error`
- `mount.success`
- `mount.unmount.start`
- `mount.unmount.result`
- `mount.retry.start`
- `status.refresh`
- `systemAutomount.trigger.ls`
- `systemAutomount.trigger.openFinder`
- `systemAutomount.wait.active`
- `systemAutomount.wait.timeout`

Metadata can include mount id, mount name, server, share name, username, mount path, retry count, status, result, and error message. It must not include password fields.

## UI

Add a developer section to the existing settings panel:

- Toggle: "Developer Mode" / "开发者模式"
- Description: short note that logs are written locally and may include server/share/path metadata.
- Button: "Open Log File" / "打开日志文件"

The button is available even when developer mode is off so the user can inspect or share old logs.

## Error Handling

- If writing a log fails, print a concise console error and continue the mount operation.
- If opening the log file fails, return `{ success: false, error }` to the renderer and show the existing console error path.
- If the config file has no `developerMode`, it defaults to `false`.

## Testing

- Add tests for the logger writing only when developer mode is enabled.
- Add tests that sensitive fields are redacted or omitted.
- Add tests for settings default compatibility.
- Existing `npm test`, `npm run typecheck`, and `npm run build` remain the verification gate.

