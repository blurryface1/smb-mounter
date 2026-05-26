# SMB Mounter - Mac SMB 挂载管理工具设计文档

**日期**: 2026-05-26  
**状态**: 待审核

---

## 1. 项目概述

开发一个 macOS 原生风格的 SMB 挂载管理工具，提供可视化界面管理 SMB 挂载点，支持一键挂载/卸载、断线自动重连、开机自动挂载等功能。类似 Windows 上的 RaiDriveMount。

### 核心功能

- **状态监控** — 菜单栏图标显示挂载状态，列出所有配置的挂载点
- **一键操作** — 点击挂载/卸载/重新挂载
- **自动重连** — 挂载失败或断开后自动重试
- **开机启动** — 登录后自动挂载

### 技术选型

| 项目 | 选择 |
|------|------|
| 框架 | Electron 28+ |
| 前端 | React 18 + TypeScript |
| 样式 | Tailwind CSS |
| 协议 | 仅 SMB |
| 密码存储 | 应用内 AES-256-GCM 加密 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    Electron App                      │
├────────────────────────────────────────────────────┤
│  菜单栏图标    │  主窗口    │  设置窗口           │
│  (状态监控)    │  (挂载列表) │  (添加/编辑挂载点) │
├─────────────────┴────────────┴──────────────────────┤
│                     Core Services                     │
│  • MountManager (挂载/卸载/重试)                      │
│  • ConnectionMonitor (心跳检测)                       │
│  • ConfigStore (配置+密码加密存储)                    │
│  • AutoLauncher (开机启动)                            │
├─────────────────────────────────────────────────────┤
│                   Node.js Backend                     │
│  • mount_smbfs / umount 命令调用                      │
│  • DNS 刷新 (dscacheutil)                             │
│  • 文件系统监听                                       │
└─────────────────────────────────────────────────────┘
```

---

## 3. 界面设计

### 3.1 菜单栏面板

点击菜单栏图标弹出的小面板：

```
┌─────────────────────────────┐
│  📦 SMB Mounter          ⚙️ │
├─────────────────────────────┤
│  🟢 仓库                    │
│     /mnt/SMB/仓库           │
│     [卸载]                  │
├─────────────────────────────┤
│  🔴 文件                    │
│     /mnt/SMB/文件           │
│     [重试挂载]              │
├─────────────────────────────┤
│  🟢 UNRAID                  │
│     /mnt/SMB/UNRAID         │
│     [卸载]                  │
├─────────────────────────────┤
│  [+ 添加挂载]  [全部重试]   │
└─────────────────────────────┘
```

- 图标状态：🟢 已挂载 / 🔴 断开 / ⚪ 未配置
- 点击挂载项 → 在 Finder 中打开

### 3.2 设置窗口

独立窗口，用于添加/编辑挂载配置：

```
┌─────────────────────────────────────────────┐
│  SMB Mounter 设置                       [×] │
├─────────────────────────────────────────────┤
│  挂载列表        │  添加/编辑挂载            │
│  ┌─────────────┐ │  ┌──────────────────────┐│
│  │ 仓库    🟢  │ │  │ 名称: [仓库        ] ││
│  │ 文件    🔴  │ │  │ 服务器: [FNNAS.local]││
│  │ UNRAID  🟢  │ │  │ 共享名: [外接存储..]││
│  │             │ │  │ 用户名: [admin     ] ││
│  │             │ │  │ 密码:   [••••••    ] ││
│  │             │ │  │ 挂载路径:[/mnt/SMB] ││
│  └─────────────┘ │  │ ☑ 开机自动挂载      ││
│                  │  │ ☑ 断开自动重试      ││
│                  │  │ 重试间隔: [30] 秒    ││
│                  │  └──────────────────────┘│
│                  │  [保存] [测试连接] [删除]│
├─────────────────────────────────────────────┤
│  通用设置                                   │
│  ☑ 开机启动                                │
│  ☑ 挂载成功时发送通知                      │
│  默认挂载路径: [/Volumes/SMB]              │
└─────────────────────────────────────────────┘
```

---

## 4. 核心功能逻辑

### 4.1 挂载流程

```
用户点击"挂载" 
    ↓
检查服务器可达性 (ping)
    ↓
刷新 DNS 缓存 (dscacheutil -flushcache)
    ↓
创建挂载目录 (mkdir -p)
    ↓
执行 mount_smbfs //user@server/share /path
    ↓
成功 → 标记状态为 🟢，发送通知
失败 → 标记状态为 🔴，启动重试计时器
```

### 4.2 自动重连机制

```
ConnectionMonitor (每 30 秒检测)
    ↓
遍历所有已配置的挂载点
    ↓
检查挂载状态 (mount | grep smbfs)
    ↓
发现断开 → 刷新 DNS → 尝试重新挂载
    ↓
重试失败 → 增加重试计数，等待下一周期
    ↓
超过最大重试次数 → 弹出通知提示手动处理
```

### 4.3 开机自动挂载

```
系统登录 → AutoLauncher 触发
    ↓
遍历标记为"开机自动挂载"的配置
    ↓
依次执行挂载流程（带延迟，避免并发）
    ↓
全部完成 → 发送通知汇总状态
```

### 4.4 密码加密存储

使用 AES-256-GCM 加密：

```
保存密码:
    ↓
生成随机 salt (16 bytes)
    ↓
使用 AES-256-GCM 加密密码
    ↓
存储: { salt, iv, encryptedData, authTag }

读取密码:
    ↓
读取加密数据
    ↓
使用 masterKey (首次启动时生成) 解密
    ↓
返回明文密码用于挂载命令
```

---

## 5. 项目结构

```
smb-mounter/
├── package.json
├── electron-builder.yml          # 打包配置
├── src/
│   ├── main/                     # Electron 主进程
│   │   ├── index.ts              # 入口，创建窗口/菜单栏
│   │   ├── tray.ts               # 菜单栏图标管理
│   │   ├── ipcHandlers.ts        # IPC 通信处理
│   │   └── autoLauncher.ts       # 开机启动逻辑
│   │
│   ├── renderer/                 # React 前端
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TrayPanel.tsx     # 菜单栏弹出面板
│   │   │   ├── MainWindow.tsx    # 设置主窗口
│   │   │   ├── MountItem.tsx     # 单个挂载项组件
│   │   │   └── MountForm.tsx     # 添加/编辑表单
│   │   └── hooks/
│   │       ├── useMounts.ts      # 挂载状态管理
│   │       └── useConfig.ts      # 配置管理
│   │
│   ├── core/                     # 核心业务逻辑
│   │   ├── mountManager.ts       # 挂载/卸载操作
│   │   ├── connectionMonitor.ts  # 连接状态监控
│   │   ├── configStore.ts        # 配置读写 + 加密
│   │   ├── crypto.ts             # AES 加密工具
│   │   └── smbClient.ts          # SMB 命令执行
│   │
│   └── types/                    # TypeScript 类型定义
│       ├── mount.ts
│       └── config.ts
│
├── assets/
│   ├── icon.png                  # 应用图标
│   └── tray-icon.png             # 菜单栏图标（多状态）
│
└── dist/                         # 构建输出
```

---

## 6. 关键技术点

| 功能 | 实现方式 |
|------|---------|
| 菜单栏图标 | Electron Tray API |
| 弹出面板 | BrowserWindow + frameless |
| SMB 挂载命令 | `spawn('mount_smbfs', args)` |
| 检测挂载状态 | `mount | grep smbfs` |
| DNS 刷新 | `spawn('dscacheutil', ['-flushcache'])` |
| 开机启动 | `spawn('osascript', login item script)` |
| 配置存储 | JSON 文件 + AES-256-GCM 加密 |

---

## 7. 数据模型

### MountConfig 挂载配置

```typescript
interface MountConfig {
  id: string;
  name: string;           // 显示名称，如 "仓库"
  server: string;         // 服务器地址，如 "FNNAS.local"
  shareName: string;      // SMB 共享名
  username: string;
  password?: string;      // 加密存储
  mountPath: string;      // 本地挂载路径
  autoMount: boolean;    // 开机自动挂载
  autoRetry: boolean;     // 断开自动重试
  retryInterval: number;  // 重试间隔（秒）
}
```

### MountStatus 挂载状态

```typescript
interface MountStatus {
  configId: string;
  status: 'mounted' | 'disconnected' | 'error' | 'pending';
  lastChecked: Date;
  retryCount: number;
  errorMessage?: string;
}
```

---

## 8. 配置文件位置

- 应用配置：`~/.smb-mounter/config.json`
- 加密密码：`~/.smb-mounter/credentials.enc`
- Master Key：存储在 macOS Keychain 中

---

## 9. 后续扩展（可选）

- [ ] 支持多个 SMB 服务器
- [ ] 导入/导出配置
- [ ] 挂载历史记录
- [ ] 流量统计
- [ ] 支持 WebDAV/NFS 协议
