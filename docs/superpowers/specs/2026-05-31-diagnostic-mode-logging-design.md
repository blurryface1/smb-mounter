# Diagnostic Mode Logging Design

## Goal

Add a diagnostic mode that can be enabled from settings. When enabled, SMB Mounter records diagnostic logs to a local file and exposes an in-app action to open that log file. The feature is for troubleshooting mount, retry, refresh, and macOS system automount behavior without requiring a terminal.

## Scope

- Add a persisted `diagnosticMode` setting, defaulting to `false`.
- Add a settings panel toggle for diagnostic mode.
- Add a settings panel action to open the log file with the system default app.
- Write logs only when diagnostic mode is enabled.
- Keep logs local under the app config directory, using `~/.smb-mounter/logs/app.log`.
- Limit `app.log` to 5MB. When it exceeds the limit, rotate it to `app.log.1` and keep only that one old file.
- Record diagnostic events around mount lifecycle operations and system automount activation.
- Record core/main-process events only. Renderer UI click streams are out of scope for the first version.
- Do not log passwords, encrypted credentials, SMB URLs with passwords, or arbitrary file contents.

## Architecture

Create a small main-process logger module in `src/core/diagnosticLogger.ts`. It will own log path creation, setting checks, redaction, and append-only writes. Core modules can call it without knowing where the file lives.

The renderer will not write logs directly. It will use IPC for two actions:

- `get-log-file-info`: returns the path and whether the file exists.
- `open-log-file`: opens the log file with the system default app, creating the parent directory and an empty file if needed.

Settings will remain the source of truth for whether logging is enabled.

Renderer UI interactions are not logged directly in the first version. If UI event diagnostics become necessary later, they should go through a dedicated IPC boundary rather than writing from the renderer.

## Data Flow

1. User enables diagnostic mode in settings.
2. `updateSettings({ diagnosticMode: true })` persists it to `~/.smb-mounter/config.json`.
3. Mount-related core code calls `diagnosticLog(...)`.
4. The logger checks the current setting before writing.
5. Each log line is newline-delimited JSON with timestamp, level, event name, and structured metadata.
6. User clicks "Open Log File" in settings.
7. Main process opens `~/.smb-mounter/logs/app.log` through the system default app.

## Retention

The logger keeps at most two files:

- `app.log`: current log file, rotated once it exceeds 5MB.
- `app.log.1`: previous log file.

Older rotated files are deleted. This prevents a forgotten diagnostic mode from growing local storage without bound.

## Log Events

Each line is a single JSON object:

```json
{"ts":"2026-05-31T10:20:30.123Z","level":"info","event":"mount.start","mountId":"mount-...","server":"FNNAS.local","shareName":"UNRAID","username":"admin","mountPath":"/System/Volumes/Data/mnt/SMB/UNRAID"}
```

Required fields:

- `ts`: ISO timestamp.
- `level`: `info`, `warn`, or `error`.
- `event`: stable event name.

Additional fields are event metadata after redaction.

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

Metadata should include full non-password SMB identity fields when relevant: mount id, mount name, server, share name, username, mount path, retry count, status, result, and error message. It must not include password fields, encrypted credential fields, or SMB URLs containing passwords.

## UI

Add a diagnostics section to the existing settings panel:

- Toggle: "Diagnostic Mode" / "诊断模式"
- Description: short note that logs are written locally and may include server/share/path metadata.
- Button: "Open Log File" / "打开日志文件"

The button is available even when diagnostic mode is off so the user can inspect or share old logs. If the log file does not exist, the app creates an empty `app.log` before opening it. It opens the `.log` file with the system default app rather than only revealing it in Finder.

## Error Handling

- If writing a log fails, print a concise console error and continue the mount operation.
- If opening the log file fails, return `{ success: false, error }` to the renderer and show the existing console error path.
- If the config file has no `diagnosticMode`, it defaults to `false`.

## Testing

- Add tests for the logger writing only when diagnostic mode is enabled.
- Add tests that sensitive fields are redacted or omitted.
- Add tests for settings default compatibility.
- Existing `npm test`, `npm run typecheck`, and `npm run build` remain the verification gate.
