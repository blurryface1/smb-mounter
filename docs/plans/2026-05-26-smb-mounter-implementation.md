# SMB Mounter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron app to manage SMB mounts with menu bar UI, auto-reconnect, and encrypted credential storage.

**Architecture:** Electron main process handles system integration (Tray, IPC, mount commands). React frontend provides UI. Core services layer handles mount operations, monitoring, and config storage with AES encryption.

**Tech Stack:** Electron 28+, React 18, TypeScript, Tailwind CSS, electron-builder

---

## File Structure

```
smb-mounter/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron-builder.yml
├── .gitignore
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron entry point
│   │   ├── tray.ts               # Tray icon management
│   │   ├── ipc.ts                # IPC handlers
│   │   └── autoLauncher.ts       # Login item setup
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── style.css
│   │   ├── components/
│   │   │   ├── TrayPanel.tsx
│   │   │   ├── SettingsWindow.tsx
│   │   │   ├── MountList.tsx
│   │   │   ├── MountItem.tsx
│   │   │   └── MountForm.tsx
│   │   └── hooks/
│   │       ├── useMounts.ts
│   │       └── useConfig.ts
│   │
│   ├── core/
│   │   ├── mountManager.ts
│   │   ├── connectionMonitor.ts
│   │   ├── configStore.ts
│   │   ├── crypto.ts
│   │   └── smb.ts
│   │
│   └── types/
│       └── index.ts
│
└── assets/
    ├── icon.png
    ├── trayConnected.png
    ├── trayDisconnected.png
    └── trayError.png
```

---

## Phase 1: Project Setup

### Task 1: Initialize Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "smb-mounter",
  "version": "1.0.0",
  "description": "macOS SMB mount manager",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "electron-store": "^8.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "electron": "^28.1.0",
    "electron-builder": "^24.9.1",
    "electron-vite": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.app.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/renderer"]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["src/main", "vite.config.ts"]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
.env
```

- [ ] **Step 6: Initialize git repo**

```bash
cd ~/文件/Projects/smb-mounter
git init
git add .
git commit -m "chore: initialize project"
```

---

### Task 2: Configure Vite and Electron

**Files:**
- Create: `vite.config.ts`
- Create: `electron.vite.config.ts`
- Create: `electron-builder.yml`

- [ ] **Step 1: Create electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 2: Create electron-builder.yml**

```yaml
appId: com.smbmounter.app
productName: SMB Mounter
directories:
  buildResources: build
files:
  - '!**/.git/*'
  - '!**/node_modules/*'
  - '!src/*'
mac:
  category: public.app-category.utilities
  target:
    - target: dmg
    - target: zip
  hardenedRuntime: true
  gatekeeperAssess: false
```

- [ ] **Step 3: Install dependencies**

```bash
cd ~/文件/Projects/smb-mounter
npm install
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: add build configuration"
```

---

## Phase 2: Core Types and Utilities

### Task 3: Define TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// src/types/index.ts

export interface MountConfig {
  id: string
  name: string
  server: string
  shareName: string
  username: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
  createdAt: number
  updatedAt: number
}

export interface StoredMountConfig extends MountConfig {
  encryptedPassword?: string
}

export interface MountStatus {
  configId: string
  status: 'mounted' | 'disconnected' | 'error' | 'pending'
  lastChecked: number
  retryCount: number
  errorMessage?: string
}

export interface AppConfig {
  mounts: StoredMountConfig[]
  settings: AppSettings
}

export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  showNotifications: true,
  defaultMountPath: '/Volumes/SMB',
  checkInterval: 30
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add type definitions"
```

---

### Task 4: Implement Crypto Module

**Files:**
- Create: `src/core/crypto.ts`

- [ ] **Step 1: Create crypto utility**

```typescript
// src/core/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16

function getMasterKey(): Buffer {
  // In production, this should be stored in macOS Keychain
  // For now, we derive from a machine-specific identifier
  const machineId = require('os').hostname()
  return scryptSync(machineId, 'smb-mounter-salt', 32)
}

export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)
  
  const key = scryptSync(masterKey, salt, 32)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  
  const authTag = cipher.getAuthTag()
  
  // Format: salt (32) + iv (16) + authTag (16) + encrypted
  const result = Buffer.concat([salt, iv, authTag, encrypted])
  return result.toString('base64')
}

export function decrypt(encryptedData: string): string {
  const masterKey = getMasterKey()
  const buffer = Buffer.from(encryptedData, 'base64')
  
  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
  
  const key = scryptSync(masterKey, salt, 32)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('Decryption failed - data may be corrupted')
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/crypto.ts
git commit -m "feat: add AES-256-GCM encryption module"
```

---

### Task 5: Implement Config Store

**Files:**
- Create: `src/core/configStore.ts`

- [ ] **Step 1: Create config store**

```typescript
// src/core/configStore.ts
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { StoredMountConfig, AppConfig, AppSettings, DEFAULT_SETTINGS } from '../types'
import { encrypt, decrypt } from './crypto'

const CONFIG_DIR = join(app.getPath('home'), '.smb-mounter')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function loadRawConfig(): AppConfig {
  ensureConfigDir()
  
  if (!existsSync(CONFIG_FILE)) {
    return { mounts: [], settings: DEFAULT_SETTINGS }
  }
  
  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { mounts: [], settings: DEFAULT_SETTINGS }
  }
}

export function loadConfig(): AppConfig {
  return loadRawConfig()
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir()
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function getMounts(): StoredMountConfig[] {
  return loadConfig().mounts
}

export function getMountById(id: string): StoredMountConfig | undefined {
  return getMounts().find(m => m.id === id)
}

export function addMount(mount: Omit<StoredMountConfig, 'id' | 'createdAt' | 'updatedAt'> & { password?: string }): StoredMountConfig {
  const config = loadRawConfig()
  
  const now = Date.now()
  const newMount: StoredMountConfig = {
    ...mount,
    id: `mount-${now}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    encryptedPassword: mount.password ? encrypt(mount.password) : undefined
  }
  
  // Remove password from stored version
  delete (newMount as any).password
  
  config.mounts.push(newMount)
  saveConfig(config)
  
  return newMount
}

export function updateMount(id: string, updates: Partial<StoredMountConfig> & { password?: string }): StoredMountConfig | null {
  const config = loadRawConfig()
  const index = config.mounts.findIndex(m => m.id === id)
  
  if (index === -1) return null
  
  const existing = config.mounts[index]
  const updated: StoredMountConfig = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    encryptedPassword: updates.password 
      ? encrypt(updates.password) 
      : updates.encryptedPassword ?? existing.encryptedPassword
  }
  
  delete (updated as any).password
  
  config.mounts[index] = updated
  saveConfig(config)
  
  return updated
}

export function deleteMount(id: string): boolean {
  const config = loadRawConfig()
  const index = config.mounts.findIndex(m => m.id === id)
  
  if (index === -1) return false
  
  config.mounts.splice(index, 1)
  saveConfig(config)
  return true
}

export function getDecryptedPassword(mount: StoredMountConfig): string | null {
  if (!mount.encryptedPassword) return null
  
  try {
    return decrypt(mount.encryptedPassword)
  } catch {
    return null
  }
}

export function getSettings(): AppSettings {
  return loadConfig().settings
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const config = loadRawConfig()
  config.settings = { ...config.settings, ...updates }
  saveConfig(config)
  return config.settings
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/configStore.ts
git commit -m "feat: add config store with encrypted password handling"
```

---

### Task 6: Implement SMB Mount Commands

**Files:**
- Create: `src/core/smb.ts`

- [ ] **Step 1: Create SMB utilities**

```typescript
// src/core/smb.ts
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface MountResult {
  success: boolean
  error?: string
}

export async function checkServerReachable(server: string): Promise<boolean> {
  try {
    await execAsync(`ping -c 1 -W 2 ${server}`)
    return true
  } catch {
    return false
  }
}

export async function flushDNS(): Promise<void> {
  try {
    await execAsync('dscacheutil -flushcache')
    await execAsync('killall -HUP mDNSResponder')
  } catch {
    // Ignore errors
  }
}

export async function mountSMB(
  server: string,
  shareName: string,
  username: string,
  password: string,
  mountPath: string
): Promise<MountResult> {
  const { mkdirSync, existsSync } = require('fs')
  
  // Ensure mount directory exists
  if (!existsSync(mountPath)) {
    try {
      mkdirSync(mountPath, { recursive: true })
    } catch (err: any) {
      return { success: false, error: `Failed to create mount directory: ${err.message}` }
    }
  }
  
  return new Promise((resolve) => {
    const smbUrl = `//${encodeURIComponent(username)}:${encodeURIComponent(password)}@${server}/${shareName}`
    
    const proc = spawn('mount_smbfs', [smbUrl, mountPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    let stderr = ''
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ 
          success: false, 
          error: stderr || `mount_smbfs exited with code ${code}` 
        })
      }
    })
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function unmountSMB(mountPath: string): Promise<MountResult> {
  return new Promise((resolve) => {
    const proc = spawn('umount', [mountPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    let stderr = ''
    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ 
          success: false, 
          error: stderr || `umount exited with code ${code}` 
        })
      }
    })
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export async function getMountedShares(): Promise<Map<string, string>> {
  try {
    const { stdout } = await execAsync('mount | grep smbfs')
    const mounts = new Map<string, string>()
    
    stdout.trim().split('\n').forEach(line => {
      // Format: //user@server/share on /path (smbfs, ...)
      const match = line.match(/^\/\/[^@]+@([^/]+)\/(\S+)\s+on\s+(\S+)\s+/)
      if (match) {
        const [, server, share, path] = match
        mounts.set(path, `${server}/${share}`)
      }
    })
    
    return mounts
  } catch {
    return new Map()
  }
}

export async function isMountActive(mountPath: string): Promise<boolean> {
  const mounts = await getMountedShares()
  return mounts.has(mountPath)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/smb.ts
git commit -m "feat: add SMB mount/unmount utilities"
```

---

### Task 7: Implement Mount Manager

**Files:**
- Create: `src/core/mountManager.ts`

- [ ] **Step 1: Create mount manager**

```typescript
// src/core/mountManager.ts
import { BrowserWindow, Notification } from 'electron'
import { StoredMountConfig, MountStatus } from '../types'
import { getMountById, getMounts, getDecryptedPassword } from './configStore'
import { mountSMB, unmountSMB, isMountActive, checkServerReachable, flushDNS } from './smb'

class MountManager {
  private statuses: Map<string, MountStatus> = new Map()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  getStatus(configId: string): MountStatus | undefined {
    return this.statuses.get(configId)
  }

  getAllStatuses(): MountStatus[] {
    return Array.from(this.statuses.values())
  }

  async refreshStatus(mount: StoredMountConfig): Promise<MountStatus> {
    const active = await isMountActive(mount.mountPath)
    const existing = this.statuses.get(mount.id)
    
    const status: MountStatus = {
      configId: mount.id,
      status: active ? 'mounted' : 'disconnected',
      lastChecked: Date.now(),
      retryCount: existing?.retryCount ?? 0
    }
    
    this.statuses.set(mount.id, status)
    this.notifyStatusChange(mount.id, status)
    
    return status
  }

  async refreshAllStatuses(): Promise<void> {
    const mounts = getMounts()
    await Promise.all(mounts.map(m => this.refreshStatus(m)))
  }

  async mount(configId: string): Promise<{ success: boolean; error?: string }> {
    const mount = getMountById(configId)
    if (!mount) {
      return { success: false, error: 'Mount config not found' }
    }

    // Update status to pending
    this.statuses.set(configId, {
      configId,
      status: 'pending',
      lastChecked: Date.now(),
      retryCount: 0
    })
    this.notifyStatusChange(configId, this.statuses.get(configId)!)

    // Check if already mounted
    if (await isMountActive(mount.mountPath)) {
      return { success: true }
    }

    // Check server reachable
    const reachable = await checkServerReachable(mount.server)
    if (!reachable) {
      await flushDNS()
      // Try again after DNS flush
      const retryReachable = await checkServerReachable(mount.server)
      if (!retryReachable) {
        const status: MountStatus = {
          configId,
          status: 'error',
          lastChecked: Date.now(),
          retryCount: 0,
          errorMessage: `Cannot reach server ${mount.server}`
        }
        this.statuses.set(configId, status)
        this.notifyStatusChange(configId, status)
        return { success: false, error: status.errorMessage }
      }
    }

    // Get password
    const password = getDecryptedPassword(mount)
    if (!password) {
      const status: MountStatus = {
        configId,
        status: 'error',
        lastChecked: Date.now(),
        retryCount: 0,
        errorMessage: 'Password not available'
      }
      this.statuses.set(configId, status)
      this.notifyStatusChange(configId, status)
      return { success: false, error: status.errorMessage }
    }

    // Mount
    const result = await mountSMB(
      mount.server,
      mount.shareName,
      mount.username,
      password,
      mount.mountPath
    )

    const status: MountStatus = {
      configId,
      status: result.success ? 'mounted' : 'error',
      lastChecked: Date.now(),
      retryCount: 0,
      errorMessage: result.error
    }
    this.statuses.set(configId, status)
    this.notifyStatusChange(configId, status)

    if (result.success) {
      this.showNotification(`${mount.name} mounted successfully`)
    }

    return result
  }

  async unmount(configId: string): Promise<{ success: boolean; error?: string }> {
    const mount = getMountById(configId)
    if (!mount) {
      return { success: false, error: 'Mount config not found' }
    }

    const result = await unmountSMB(mount.mountPath)

    const status: MountStatus = {
      configId,
      status: result.success ? 'disconnected' : 'error',
      lastChecked: Date.now(),
      retryCount: 0,
      errorMessage: result.error
    }
    this.statuses.set(configId, status)
    this.notifyStatusChange(configId, status)

    return result
  }

  async retryMount(configId: string): Promise<{ success: boolean; error?: string }> {
    const existing = this.statuses.get(configId)
    
    if (existing) {
      this.statuses.set(configId, {
        ...existing,
        retryCount: existing.retryCount + 1
      })
    }

    await flushDNS()
    return this.mount(configId)
  }

  private notifyStatusChange(configId: string, status: MountStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mount-status-changed', { configId, status })
    }
  }

  private showNotification(message: string): void {
    const settings = require('./configStore').getSettings()
    if (settings.showNotifications) {
      new Notification({
        title: 'SMB Mounter',
        body: message
      }).show()
    }
  }
}

export const mountManager = new MountManager()
```

- [ ] **Step 2: Commit**

```bash
git add src/core/mountManager.ts
git commit -m "feat: add mount manager with status tracking"
```

---

### Task 8: Implement Connection Monitor

**Files:**
- Create: `src/core/connectionMonitor.ts`

- [ ] **Step 1: Create connection monitor**

```typescript
// src/core/connectionMonitor.ts
import { getMounts, getSettings } from './configStore'
import { mountManager } from './mountManager'

class ConnectionMonitor {
  private intervalId: NodeJS.Timeout | null = null

  start(): void {
    if (this.intervalId) return
    
    const checkInterval = getSettings().checkInterval * 1000
    
    this.intervalId = setInterval(() => {
      this.checkAllMounts()
    }, checkInterval)
    
    // Initial check
    this.checkAllMounts()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async checkAllMounts(): Promise<void> {
    const mounts = getMounts()
    
    for (const mount of mounts) {
      const status = await mountManager.refreshStatus(mount)
      
      // Auto-retry disconnected mounts that have autoRetry enabled
      if (status.status === 'disconnected' && mount.autoRetry) {
        console.log(`Auto-retrying mount: ${mount.name}`)
        await mountManager.retryMount(mount.id)
      }
    }
  }

  async checkAndRemount(): Promise<void> {
    const mounts = getMounts()
    
    for (const mount of mounts) {
      if (mount.autoMount) {
        const status = await mountManager.refreshStatus(mount)
        if (status.status === 'disconnected') {
          await mountManager.mount(mount.id)
        }
      }
    }
  }
}

export const connectionMonitor = new ConnectionMonitor()
```

- [ ] **Step 2: Commit**

```bash
git add src/core/connectionMonitor.ts
git commit -m "feat: add connection monitor with auto-retry"
```

---

## Phase 3: Electron Main Process

### Task 9: Create Electron Entry Point

**Files:**
- Create: `src/main/index.ts`

- [ ] **Step 1: Create main entry**

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { setupAutoLauncher } from './autoLauncher'
import { mountManager } from '../core/mountManager'
import { connectionMonitor } from '../core/connectionMonitor'

let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  win.loadFile(join(__dirname, '../renderer/index.html'))
  
  win.on('close', (e) => {
    e.preventDefault()
    win.hide()
  })
  
  return win
}

app.whenReady().then(() => {
  mainWindow = createMainWindow()
  mountManager.setMainWindow(mainWindow)
  
  setupTray(mainWindow)
  setupIPC(mainWindow)
  setupAutoLauncher()
  
  connectionMonitor.start()
  
  // Initial status refresh
  mountManager.refreshAllStatuses()
})

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
})

app.on('before-quit', () => {
  connectionMonitor.stop()
})

// Export for other modules
export { mainWindow }
```

- [ ] **Step 2: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add Electron main process entry"
```

---

### Task 10: Create Tray Module

**Files:**
- Create: `src/main/tray.ts`

- [ ] **Step 1: Create tray module**

```typescript
// src/main/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(__dirname, '../../assets/trayConnected.png')
  const icon = nativeImage.createFromPath(iconPath)
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  
  updateTrayMenu(mainWindow)
  
  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function updateTrayMenu(mainWindow: BrowserWindow): void {
  if (!tray) return
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Refresh All Mounts',
      click: () => {
        // Will trigger via IPC
        mainWindow.webContents.send('refresh-all-mounts')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('SMB Mounter')
  tray.setContextMenu(contextMenu)
}

export function updateTrayIcon(status: 'connected' | 'disconnected' | 'error'): void {
  if (!tray) return
  
  const iconMap = {
    connected: 'trayConnected.png',
    disconnected: 'trayDisconnected.png',
    error: 'trayError.png'
  }
  
  const iconPath = join(__dirname, '../../assets', iconMap[status])
  const icon = nativeImage.createFromPath(iconPath)
  tray.setImage(icon.resize({ width: 16, height: 16 }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/tray.ts
git commit -m "feat: add system tray support"
```

---

### Task 11: Create IPC Handlers

**Files:**
- Create: `src/main/ipc.ts`

- [ ] **Step 1: Create IPC handlers**

```typescript
// src/main/ipc.ts
import { BrowserWindow, ipcMain } from 'electron'
import { mountManager } from '../core/mountManager'
import { connectionMonitor } from '../core/connectionMonitor'
import {
  loadConfig,
  saveConfig,
  getMounts,
  addMount,
  updateMount,
  deleteMount,
  getSettings,
  updateSettings
} from '../core/configStore'

export function setupIPC(mainWindow: BrowserWindow): void {
  // Config operations
  ipcMain.handle('get-config', () => {
    return loadConfig()
  })

  ipcMain.handle('get-mounts', () => {
    return getMounts()
  })

  ipcMain.handle('add-mount', (_, mount) => {
    return addMount(mount)
  })

  ipcMain.handle('update-mount', (_, id, updates) => {
    return updateMount(id, updates)
  })

  ipcMain.handle('delete-mount', (_, id) => {
    return deleteMount(id)
  })

  ipcMain.handle('get-settings', () => {
    return getSettings()
  })

  ipcMain.handle('update-settings', (_, updates) => {
    return updateSettings(updates)
  })

  // Mount operations
  ipcMain.handle('mount', (_, configId) => {
    return mountManager.mount(configId)
  })

  ipcMain.handle('unmount', (_, configId) => {
    return mountManager.unmount(configId)
  })

  ipcMain.handle('retry-mount', (_, configId) => {
    return mountManager.retryMount(configId)
  })

  ipcMain.handle('get-mount-status', (_, configId) => {
    return mountManager.getStatus(configId)
  })

  ipcMain.handle('get-all-statuses', () => {
    return mountManager.getAllStatuses()
  })

  ipcMain.handle('refresh-status', (_, configId) => {
    const mount = getMounts().find(m => m.id === configId)
    if (mount) {
      return mountManager.refreshStatus(mount)
    }
    return null
  })

  ipcMain.handle('refresh-all-statuses', async () => {
    await mountManager.refreshAllStatuses()
    return mountManager.getAllStatuses()
  })

  // Connection monitor
  ipcMain.handle('check-and-remount', () => {
    return connectionMonitor.checkAndRemount()
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: add IPC handlers for renderer communication"
```

---

### Task 12: Create Auto Launcher

**Files:**
- Create: `src/main/autoLauncher.ts`

- [ ] **Step 1: Create auto launcher**

```typescript
// src/main/autoLauncher.ts
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getSettings, updateSettings } from '../core/configStore'

const execAsync = promisify(exec)

const APP_NAME = 'SMB Mounter'

function getAppBundlePath(): string {
  // In development, return empty
  if (!app.isPackaged) return ''
  return app.getPath('exe')
}

export async function enableLaunchAtLogin(): Promise<boolean> {
  try {
    const appPath = getAppBundlePath()
    if (!appPath) return false

    await execAsync(`osascript -e 'tell application "System Events" to make login item at end with properties {path:"${appPath}", hidden:true}'`)
    return true
  } catch (err) {
    console.error('Failed to enable launch at login:', err)
    return false
  }
}

export async function disableLaunchAtLogin(): Promise<boolean> {
  try {
    await execAsync(`osascript -e 'tell application "System Events" to delete login item "${APP_NAME}"'`)
    return true
  } catch (err) {
    console.error('Failed to disable launch at login:', err)
    return false
  }
}

export async function isLaunchAtLoginEnabled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('osascript -e "tell application \\"System Events\\" to get the name of every login item"')
    return stdout.includes(APP_NAME)
  } catch {
    return false
  }
}

export function setupAutoLauncher(): void {
  const settings = getSettings()
  
  if (settings.launchAtLogin) {
    enableLaunchAtLogin()
  }
}

export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (enabled) {
    await enableLaunchAtLogin()
  } else {
    await disableLaunchAtLogin()
  }
  updateSettings({ launchAtLogin: enabled })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/autoLauncher.ts
git commit -m "feat: add auto-launcher for login items"
```

---

### Task 13: Create Preload Script

**Files:**
- Create: `src/preload/index.ts`

- [ ] **Step 1: Create preload script**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  getMounts: () => ipcRenderer.invoke('get-mounts'),
  addMount: (mount: any) => ipcRenderer.invoke('add-mount', mount),
  updateMount: (id: string, updates: any) => ipcRenderer.invoke('update-mount', id, updates),
  deleteMount: (id: string) => ipcRenderer.invoke('delete-mount', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates: any) => ipcRenderer.invoke('update-settings', updates),

  // Mount operations
  mount: (configId: string) => ipcRenderer.invoke('mount', configId),
  unmount: (configId: string) => ipcRenderer.invoke('unmount', configId),
  retryMount: (configId: string) => ipcRenderer.invoke('retry-mount', configId),
  getMountStatus: (configId: string) => ipcRenderer.invoke('get-mount-status', configId),
  getAllStatuses: () => ipcRenderer.invoke('get-all-statuses'),
  refreshStatus: (configId: string) => ipcRenderer.invoke('refresh-status', configId),
  refreshAllStatuses: () => ipcRenderer.invoke('refresh-all-statuses'),

  // Events
  onMountStatusChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('mount-status-changed', (_, data) => callback(data))
  },
  onRefreshAllMounts: (callback: () => void) => {
    ipcRenderer.on('refresh-all-mounts', () => callback())
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: add preload script for secure IPC"
```

---

## Phase 4: React Frontend

### Task 14: Setup React and Tailwind

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/style.css`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta nameviewport="width=device-width, initial-scale=1.0">
  <title>SMB Mounter</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Create style.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-100 text-gray-900;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  @apply bg-transparent;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded;
}
```

- [ ] **Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {}
  },
  plugins: []
}
```

- [ ] **Step 5: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: setup React and Tailwind CSS"
```

---

### Task 15: Create App Component

**Files:**
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Create App component**

```tsx
import React from 'react'
import SettingsWindow from './components/SettingsWindow'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SettingsWindow />
    </div>
  )
}

export default App
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add main App component"
```

---

### Task 16: Create Custom Hooks

**Files:**
- Create: `src/renderer/hooks/useMounts.ts`
- Create: `src/renderer/hooks/useConfig.ts`

- [ ] **Step 1: Create useMounts hook**

```tsx
// src/renderer/hooks/useMounts.ts
import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    api: {
      getMounts: () => Promise<any[]>
      addMount: (mount: any) => Promise<any>
      updateMount: (id: string, updates: any) => Promise<any>
      deleteMount: (id: string) => Promise<boolean>
      mount: (id: string) => Promise<{ success: boolean; error?: string }>
      unmount: (id: string) => Promise<{ success: boolean; error?: string }>
      retryMount: (id: string) => Promise<{ success: boolean; error?: string }>
      getAllStatuses: () => Promise<any[]>
      refreshAllStatuses: () => Promise<any[]>
      onMountStatusChanged: (callback: (data: any) => void) => void
      onRefreshAllMounts: (callback: () => void) => void
    }
  }
}

export interface MountConfig {
  id: string
  name: string
  server: string
  shareName: string
  username: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
}

export interface MountStatus {
  configId: string
  status: 'mounted' | 'disconnected' | 'error' | 'pending'
  lastChecked: number
  retryCount: number
  errorMessage?: string
}

export function useMounts() {
  const [mounts, setMounts] = useState<MountConfig[]>([])
  const [statuses, setStatuses] = useState<Map<string, MountStatus>>(new Map())
  const [loading, setLoading] = useState(true)

  const loadMounts = useCallback(async () => {
    const data = await window.api.getMounts()
    setMounts(data)
    
    const statusData = await window.api.getAllStatuses()
    const statusMap = new Map<string, MountStatus>()
    statusData.forEach(s => statusMap.set(s.configId, s))
    setStatuses(statusMap)
    
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMounts()
    
    window.api.onMountStatusChanged((data) => {
      setStatuses(prev => {
        const next = new Map(prev)
        next.set(data.configId, data.status)
        return next
      })
    })
    
    window.api.onRefreshAllMounts(() => {
      loadMounts()
    })
  }, [loadMounts])

  const addMount = async (mount: Omit<MountConfig, 'id'> & { password: string }) => {
    const result = await window.api.addMount(mount)
    await loadMounts()
    return result
  }

  const updateMount = async (id: string, updates: Partial<MountConfig> & { password?: string }) => {
    const result = await window.api.updateMount(id, updates)
    await loadMounts()
    return result
  }

  const deleteMount = async (id: string) => {
    const result = await window.api.deleteMount(id)
    await loadMounts()
    return result
  }

  const mount = async (id: string) => {
    return window.api.mount(id)
  }

  const unmount = async (id: string) => {
    return window.api.unmount(id)
  }

  const retry = async (id: string) => {
    return window.api.retryMount(id)
  }

  return {
    mounts,
    statuses,
    loading,
    addMount,
    updateMount,
    deleteMount,
    mount,
    unmount,
    retry,
    refresh: loadMounts
  }
}
```

- [ ] **Step 2: Create useConfig hook**

```tsx
// src/renderer/hooks/useConfig.ts
import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<any>
      updateSettings: (updates: any) => Promise<any>
    }
  }
}

export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
}

export function useConfig() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const loadSettings = useCallback(async () => {
    const data = await window.api.getSettings()
    setSettings(data)
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const result = await window.api.updateSettings(updates)
    setSettings(result)
    return result
  }

  return {
    settings,
    updateSettings,
    refresh: loadSettings
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/
git commit -m "feat: add useMounts and useConfig hooks"
```

---

### Task 17: Create MountItem Component

**Files:**
- Create: `src/renderer/components/MountItem.tsx`

- [ ] **Step 1: Create MountItem component**

```tsx
import React from 'react'
import { MountConfig, MountStatus } from '../hooks/useMounts'

interface MountItemProps {
  mount: MountConfig
  status?: MountStatus
  onMount: (id: string) => void
  onUnmount: (id: string) => void
  onRetry: (id: string) => void
  onEdit: (mount: MountConfig) => void
  onDelete: (id: string) => void
}

const statusColors = {
  mounted: 'bg-green-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
  pending: 'bg-yellow-500 animate-pulse'
}

const statusLabels = {
  mounted: '已挂载',
  disconnected: '未连接',
  error: '错误',
  pending: '连接中...'
}

export function MountItem({ mount, status, onMount, onUnmount, onRetry, onEdit, onDelete }: MountItemProps) {
  const currentStatus = status?.status || 'disconnected'

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm mb-2">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColors[currentStatus]}`} />
        <div>
          <div className="font-medium">{mount.name}</div>
          <div className="text-sm text-gray-500">{mount.mountPath}</div>
          {status?.errorMessage && (
            <div className="text-sm text-red-500">{status.errorMessage}</div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{statusLabels[currentStatus]}</span>
        
        {currentStatus === 'mounted' && (
          <button
            onClick={() => onUnmount(mount.id)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            卸载
          </button>
        )}
        
        {currentStatus === 'disconnected' && (
          <button
            onClick={() => onMount(mount.id)}
            className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
          >
            挂载
          </button>
        )}
        
        {currentStatus === 'error' && (
          <button
            onClick={() => onRetry(mount.id)}
            className="px-3 py-1 text-sm bg-orange-500 text-white hover:bg-orange-600 rounded"
          >
            重试
          </button>
        )}
        
        <button
          onClick={() => onEdit(mount)}
          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
        >
          编辑
        </button>
        
        <button
          onClick={() => onDelete(mount.id)}
          className="px-2 py-1 text-sm text-red-500 hover:text-red-700"
        >
          删除
        </button>
      </div>
    </div>
  )
}

export default MountItem
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/MountItem.tsx
git commit -m "feat: add MountItem component"
```

---

### Task 18: Create MountList Component

**Files:**
- Create: `src/renderer/components/MountList.tsx`

- [ ] **Step 1: Create MountList component**

```tsx
import React from 'react'
import { MountItem } from './MountItem'
import { MountConfig, MountStatus } from '../hooks/useMounts'

interface MountListProps {
  mounts: MountConfig[]
  statuses: Map<string, MountStatus>
  onMount: (id: string) => void
  onUnmount: (id: string) => void
  onRetry: (id: string) => void
  onEdit: (mount: MountConfig) => void
  onDelete: (id: string) => void
}

export function MountList({ mounts, statuses, onMount, onUnmount, onRetry, onEdit, onDelete }: MountListProps) {
  if (mounts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>暂无挂载配置</p>
        <p className="text-sm">点击下方按钮添加</p>
      </div>
    )
  }

  return (
    <div>
      {mounts.map(mount => (
        <MountItem
          key={mount.id}
          mount={mount}
          status={statuses.get(mount.id)}
          onMount={onMount}
          onUnmount={onUnmount}
          onRetry={onRetry}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export default MountList
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/MountList.tsx
git commit -m "feat: add MountList component"
```

---

### Task 19: Create MountForm Component

**Files:**
- Create: `src/renderer/components/MountForm.tsx`

- [ ] **Step 1: Create MountForm component**

```tsx
import React, { useState, useEffect } from 'react'
import { MountConfig } from '../hooks/useMounts'

interface MountFormProps {
  mount?: MountConfig
  onSave: (data: FormData) => void
  onCancel: () => void
}

interface FormData {
  name: string
  server: string
  shareName: string
  username: string
  password: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
}

export function MountForm({ mount, onSave, onCancel }: MountFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: mount?.name || '',
    server: mount?.server || '',
    shareName: mount?.shareName || '',
    username: mount?.username || '',
    password: '',
    mountPath: mount?.mountPath || '/Volumes/SMB',
    autoMount: mount?.autoMount ?? true,
    autoRetry: mount?.autoRetry ?? true,
    retryInterval: mount?.retryInterval || 30
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          名称
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          服务器地址
        </label>
        <input
          type="text"
          name="server"
          value={formData.server}
          onChange={handleChange}
          placeholder="例如: FNNAS.local"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          共享名称
        </label>
        <input
          type="text"
          name="shareName"
          value={formData.shareName}
          onChange={handleChange}
          placeholder="例如: UNRAID"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          用户名
        </label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          密码
        </label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder={mount ? '留空保持原密码' : ''}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required={!mount}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          挂载路径
        </label>
        <input
          type="text"
          name="mountPath"
          value={formData.mountPath}
          onChange={handleChange}
          placeholder="/Volumes/SMB"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="autoMount"
            checked={formData.autoMount}
            onChange={handleChange}
            className="rounded"
          />
          <span className="text-sm">开机自动挂载</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="autoRetry"
            checked={formData.autoRetry}
            onChange={handleChange}
            className="rounded"
          />
          <span className="text-sm">断开自动重试</span>
        </label>
      </div>

      {formData.autoRetry && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            重试间隔 (秒)
          </label>
          <input
            type="number"
            name="retryInterval"
            value={formData.retryInterval}
            onChange={handleChange}
            min={5}
            max={300}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          保存
        </button>
      </div>
    </form>
  )
}

export default MountForm
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/MountForm.tsx
git commit -m "feat: add MountForm component"
```

---

### Task 20: Create SettingsWindow Component

**Files:**
- Create: `src/renderer/components/SettingsWindow.tsx`

- [ ] **Step 1: Create SettingsWindow component**

```tsx
import React, { useState } from 'react'
import { useMounts, MountConfig } from '../hooks/useMounts'
import { useConfig } from '../hooks/useConfig'
import { MountList } from './MountList'
import { MountForm } from './MountForm'

type View = 'list' | 'add' | 'edit' | 'settings'

export function SettingsWindow() {
  const { mounts, statuses, loading, addMount, updateMount, deleteMount, mount, unmount, retry, refresh } = useMounts()
  const { settings, updateSettings } = useConfig()
  
  const [view, setView] = useState<View>('list')
  const [editingMount, setEditingMount] = useState<MountConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddMount = async (data: any) => {
    try {
      await addMount(data)
      setView('list')
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdateMount = async (data: any) => {
    if (!editingMount) return
    try {
      await updateMount(editingMount.id, data)
      setView('list')
      setEditingMount(null)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteMount = async (id: string) => {
    if (confirm('确定要删除这个挂载配置吗？')) {
      await deleteMount(id)
    }
  }

  const handleEditMount = (mount: MountConfig) => {
    setEditingMount(mount)
    setView('edit')
  }

  const handleMount = async (id: string) => {
    setError(null)
    const result = await mount(id)
    if (!result.success) {
      setError(result.error || '挂载失败')
    }
  }

  const handleUnmount = async (id: string) => {
    setError(null)
    const result = await unmount(id)
    if (!result.success) {
      setError(result.error || '卸载失败')
    }
  }

  const handleRetry = async (id: string) => {
    setError(null)
    const result = await retry(id)
    if (!result.success) {
      setError(result.error || '重试失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">SMB Mounter</h1>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              刷新状态
            </button>
            <button
              onClick={() => setView('settings')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              设置
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500">&times;</button>
          </div>
        )}

        {/* Content */}
        {view === 'list' && (
          <>
            <MountList
              mounts={mounts}
              statuses={statuses}
              onMount={handleMount}
              onUnmount={handleUnmount}
              onRetry={handleRetry}
              onEdit={handleEditMount}
              onDelete={handleDeleteMount}
            />
            
            <button
              onClick={() => setView('add')}
              className="w-full mt-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              + 添加挂载
            </button>
          </>
        )}

        {view === 'add' && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">添加挂载</h2>
            <MountForm
              onSave={handleAddMount}
              onCancel={() => setView('list')}
            />
          </div>
        )}

        {view === 'edit' && editingMount && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">编辑挂载</h2>
            <MountForm
              mount={editingMount}
              onSave={handleUpdateMount}
              onCancel={() => {
                setView('list')
                setEditingMount(null)
              }}
            />
          </div>
        )}

        {view === 'settings' && settings && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">通用设置</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.launchAtLogin}
                  onChange={(e) => updateSettings({ launchAtLogin: e.target.checked })}
                  className="rounded"
                />
                <span>开机启动</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.showNotifications}
                  onChange={(e) => updateSettings({ showNotifications: e.target.checked })}
                  className="rounded"
                />
                <span>显示通知</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  默认挂载路径
                </label>
                <input
                  type="text"
                  value={settings.defaultMountPath}
                  onChange={(e) => updateSettings({ defaultMountPath: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  状态检查间隔 (秒)
                </label>
                <input
                  type="number"
                  value={settings.checkInterval}
                  onChange={(e) => updateSettings({ checkInterval: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={300}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={() => setView('list')}
              className="mt-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsWindow
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SettingsWindow.tsx
git commit -m "feat: add SettingsWindow main component"
```

---

## Phase 5: Assets and Build

### Task 21: Add Application Icons

**Files:**
- Create: `assets/icon.png` (placeholder instructions)
- Create: `assets/trayConnected.png` (placeholder instructions)
- Create: `assets/trayDisconnected.png` (placeholder instructions)
- Create: `assets/trayError.png` (placeholder instructions)

- [ ] **Step 1: Create assets directory and placeholder**

```bash
mkdir -p assets
# User needs to add actual icon files
touch assets/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add assets/.gitkeep
git commit -m "chore: add assets directory"
```

---

### Task 22: Final Build Configuration

**Files:**
- Create: `build/entitlements.mac.plist`

- [ ] **Step 1: Create macOS entitlements**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 2: Update package.json build config**

Add to package.json:

```json
"build": {
  "appId": "com.smbmounter.app",
  "productName": "SMB Mounter",
  "directories": {
    "output": "release"
  },
  "mac": {
    "category": "public.app-category.utilities",
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist",
    "target": ["dmg", "zip"]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: add build configuration"
```

---

### Task 23: Build and Test

- [ ] **Step 1: Run development build**

```bash
cd ~/文件/Projects/smb-mounter
npm run dev
```

- [ ] **Step 2: Test functionality**
- Add a new mount configuration
- Test mount/unmount
- Test auto-retry (disconnect NAS temporarily)
- Check settings persistence

- [ ] **Step 3: Build production version**

```bash
npm run dist
```

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: final build and testing"
```

---

## Self-Review Checklist

| Requirement | Task | Status |
|-------------|------|--------|
| Project setup | Task 1-2 | Covered |
| TypeScript types | Task 3 | Covered |
| AES encryption | Task 4 | Covered |
| Config storage | Task 5 | Covered |
| SMB commands | Task 6 | Covered |
| Mount manager | Task 7 | Covered |
| Connection monitor | Task 8 | Covered |
| Electron main | Task 9 | Covered |
| System tray | Task 10 | Covered |
| IPC handlers | Task 11 | Covered |
| Auto launcher | Task 12 | Covered |
| Preload script | Task 13 | Covered |
| React setup | Task 14 | Covered |
| UI components | Task 15-20 | Covered |
| Build config | Task 21-22 | Covered |

---

**Plan complete。执行选项：**

**1. Subagent-Driven (推荐)** — 每个任务分派一个子代理，任务间有审查节点，快速迭代

**2. Inline Execution** — 在当前会话中逐步执行，批量执行带检查点

**选哪种方式？**
