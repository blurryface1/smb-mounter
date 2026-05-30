# Diagnostic Mode Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings-controlled diagnostic mode that writes local JSONL logs and lets the user open the log file.

**Architecture:** Keep logging in the main/core layer. Add a focused diagnostic logger module that checks settings before writing, redacts sensitive keys, rotates `app.log` at 5MB, and exposes small IPC actions for opening the log file. Renderer changes are limited to settings UI and preload bridge wiring.

**Tech Stack:** Electron main/preload IPC, React settings panel, TypeScript core modules, Node `fs`/`path`, Node test runner.

---

## File Structure

- Create `src/core/diagnosticLogger.ts`: log path, JSONL append, redaction, 5MB rotation, open-file helper.
- Create `test/diagnosticLogger.test.mjs`: unit coverage for disabled logging, enabled logging, redaction, rotation.
- Modify `src/types/index.ts`: add `diagnosticMode` to `AppSettings` and defaults.
- Modify `src/renderer/hooks/useConfig.ts`: add `diagnosticMode` to renderer settings type.
- Modify `src/preload/index.ts`: expose `openDiagnosticLogFile`.
- Modify `src/main/ipc.ts`: sanitize `diagnosticMode`, wire `open-diagnostic-log-file`, add selected IPC logs.
- Modify `src/core/mountManager.ts`: log mount/unmount/retry/refresh lifecycle events.
- Modify `src/core/smb.ts`: log system automount trigger/wait events.
- Modify `src/renderer/components/SettingsPanel.tsx`: add diagnostics section with toggle and open-log button.
- Modify `src/renderer/i18n/locales.ts`: add Chinese/English labels.
- Modify `package.json`: include `src/core/diagnosticLogger.ts` and `test/diagnosticLogger.test.mjs` in `npm test`.

### Task 1: Settings Model

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/renderer/hooks/useConfig.ts`

- [ ] **Step 1: Add failing type expectations by compiling after use**

Expected before implementation: TypeScript fails if `diagnosticMode` is referenced but missing from `AppSettings`.

- [ ] **Step 2: Add `diagnosticMode` to shared settings**

```ts
export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
  diagnosticMode: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  showNotifications: true,
  defaultMountPath: '/Users/Shared/SMB',
  checkInterval: 30,
  diagnosticMode: false
}
```

- [ ] **Step 3: Add `diagnosticMode` to renderer settings type**

```ts
export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
  diagnosticMode: boolean
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

### Task 2: Diagnostic Logger

**Files:**
- Create: `src/core/diagnosticLogger.ts`
- Create: `test/diagnosticLogger.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add tests**

Test cases:

```js
test('does not write when diagnostic mode is disabled', async () => {
  const logger = createDiagnosticLogger({ diagnosticMode: false, baseDir })
  await logger.log('info', 'mount.start', { mountId: 'm1' })
  assert.equal(existsSync(join(baseDir, 'logs', 'app.log')), false)
})

test('writes json lines when diagnostic mode is enabled', async () => {
  const logger = createDiagnosticLogger({ diagnosticMode: true, baseDir })
  await logger.log('info', 'mount.start', { mountId: 'm1', server: 'nas.local' })
  const line = readFileSync(join(baseDir, 'logs', 'app.log'), 'utf-8').trim()
  const parsed = JSON.parse(line)
  assert.equal(parsed.level, 'info')
  assert.equal(parsed.event, 'mount.start')
  assert.equal(parsed.mountId, 'm1')
  assert.equal(parsed.server, 'nas.local')
})

test('redacts sensitive fields', async () => {
  const logger = createDiagnosticLogger({ diagnosticMode: true, baseDir })
  await logger.log('info', 'mount.start', {
    password: 'secret',
    encryptedPassword: 'cipher',
    smbUrl: '//user:secret@nas.local/share',
    mountPath: '/Volumes/share'
  })
  const parsed = JSON.parse(readFileSync(join(baseDir, 'logs', 'app.log'), 'utf-8').trim())
  assert.equal(parsed.password, undefined)
  assert.equal(parsed.encryptedPassword, undefined)
  assert.equal(parsed.smbUrl, '[redacted]')
  assert.equal(parsed.mountPath, '/Volumes/share')
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `src/core/diagnosticLogger.ts` is missing.

- [ ] **Step 3: Implement logger**

Export:

```ts
export type DiagnosticLogLevel = 'info' | 'warn' | 'error'
export interface DiagnosticLoggerOptions {
  diagnosticMode: boolean
  baseDir?: string
}
export function createDiagnosticLogger(options: DiagnosticLoggerOptions): DiagnosticLogger
export async function diagnosticLog(level: DiagnosticLogLevel, event: string, metadata?: Record<string, unknown>): Promise<void>
export function getDiagnosticLogFilePath(): string
export async function openDiagnosticLogFile(): Promise<{ success: boolean; error?: string }>
```

Implementation requirements:

- Use `~/.smb-mounter/logs/app.log` by default.
- Rotate at 5MB to `app.log.1`.
- Omit `password` and `encryptedPassword`.
- Replace URL-like sensitive fields with `[redacted]`.
- Catch write failures and `console.error('Failed to write diagnostic log:', error)`.

- [ ] **Step 4: Add test compile targets**

Add `src/core/diagnosticLogger.ts` and `test/diagnosticLogger.test.mjs` to the `npm test` command.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS.

### Task 3: Core Instrumentation

**Files:**
- Modify: `src/core/mountManager.ts`
- Modify: `src/core/smb.ts`
- Modify: `src/core/connectionMonitor.ts`

- [ ] **Step 1: Log mount lifecycle**

Add `diagnosticLog(...)` calls for `mount.start`, `mount.alreadyActive`, `mount.systemAutomount.start`, `mount.systemAutomount.result`, `mount.error`, `mount.success`, `mount.unmount.start`, `mount.unmount.result`, and `mount.retry.start`.

- [ ] **Step 2: Log status and automount checks**

Add logs for `status.refresh`, `systemAutomount.trigger.ls`, `systemAutomount.trigger.openFinder`, `systemAutomount.wait.active`, and `systemAutomount.wait.timeout`.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS.

### Task 4: IPC And Renderer UI

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/components/SettingsPanel.tsx`
- Modify: `src/renderer/i18n/locales.ts`

- [ ] **Step 1: Sanitize diagnostic setting**

In `update-settings`, keep `diagnosticMode` only when it is boolean.

- [ ] **Step 2: Add IPC**

Add:

```ts
ipcMain.handle('open-diagnostic-log-file', () => openDiagnosticLogFile())
```

Expose from preload:

```ts
openDiagnosticLogFile: () => ipcRenderer.invoke('open-diagnostic-log-file')
```

- [ ] **Step 3: Add settings UI**

Add a diagnostics section with a `diagnosticMode` toggle and "Open Log File" button. The button remains enabled when diagnostic mode is off.

- [ ] **Step 4: Add i18n labels**

Add Chinese and English labels for diagnostics section, description, toggle, open button, and open failure.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run: `git diff --stat`

Expected: only diagnostic mode logging, settings UI, tests, and the prior automount fix are present.

