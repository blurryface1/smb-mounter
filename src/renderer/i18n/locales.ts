// src/renderer/i18n/locales.ts

export const zh = {
  // 通用
  appName: 'SMB Mounter',
  loading: '加载中...',
  refresh: '刷新',
  settings: '设置',
  mounts: '共享',
  cancel: '取消',
  save: '保存',
  delete: '删除',
  edit: '编辑',
  add: '添加共享',
  confirmDelete: '确定要删除这个共享配置吗？远端文件不会被删除。',
  confirmUnmountOnDelete: '此共享当前已挂载。是否同时卸载这个共享？',
  back: '返回',

  // 摘要
  summary: {
    mounted: '{count} 已挂载',
    errors: '{count} 错误',
    autoRetry: '{count} 自动重试',
    empty: '暂无共享'
  },

  // 状态
  status: {
    mounted: '已挂载',
    disconnected: '未连接',
    error: '错误',
    pending: '挂载中...'
  },

  // 操作
  actions: {
    mount: '挂载',
    unmount: '卸载',
    retry: '重试',
    openInFinder: '打开 Finder',
    more: '更多操作'
  },

  // 挂载表单
  form: {
    name: '名称',
    server: '服务器地址',
    serverPlaceholder: '例如: FNNAS.local',
    shareName: '共享名称',
    shareNamePlaceholder: '例如: UNRAID',
    username: '用户名',
    password: '密码',
    passwordPlaceholderEdit: '留空保持原密码',
    mountPath: '挂载路径',
    mountPathPlaceholder: '/Users/Shared/SMB',
    autoMount: '开机自动挂载',
    autoRetry: '断开自动重试',
    retryInterval: '重试间隔 (秒)',
    addTitle: '添加共享',
    editTitle: '编辑共享',
    choose: '选择…',
    locationSection: '共享位置',
    credentialsSection: '凭据',
    automationSection: '自动化',
    chooseMountedShare: '选择已挂载共享',
    chooseMountPath: '选择路径',
    chooseMountedShareHint: '从系统中已挂载的 SMB 共享自动填充服务器、共享名称和路径。',
    chooseMountPathHint: '选择这个共享在本机使用的挂载路径。'
  },

  // 列表
  list: {
    emptyTitle: '暂无共享',
    emptyHint: '添加一个 SMB 共享后，就可以在这里挂载并打开。'
  },

  // 设置
  settingsPage: {
    title: '通用设置',
    launchAtLogin: '开机启动',
    showNotifications: '显示通知',
    defaultMountPath: '默认挂载路径',
    checkInterval: '状态检查间隔 (秒)',
    language: '语言',
    languageZh: '中文',
    languageEn: 'English',
    diagnosticMode: '诊断模式',
    diagnosticModeHint: '开启后记录本地诊断日志，包含服务器、共享、用户名和挂载路径等非密码字段。',
    openDiagnosticLog: '打开日志文件'
  },

  // 导入
  import: {
    title: '导入系统挂载',
    description: '检测系统中已挂载的 SMB 共享',
    detected: '检测到 {count} 个挂载',
    noMounts: '未检测到系统 SMB 挂载',
    importSelected: '导入选中',
    selectAll: '全选',
    deselectAll: '取消全选',
    name: '名称',
    server: '服务器',
    share: '共享',
    path: '路径'
  },

  // 错误
  errors: {
    mountFailed: '挂载失败',
    unmountFailed: '卸载失败',
    retryFailed: '重试失败',
    openInFinderFailed: '无法在访达中打开',
    openDiagnosticLogFailed: '无法打开诊断日志'
  }
}

export const en = {
  // Common
  appName: 'SMB Mounter',
  loading: 'Loading...',
  refresh: 'Refresh',
  settings: 'Settings',
  mounts: 'Shares',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add Share',
  confirmDelete: 'Delete this share configuration? Remote files will not be deleted.',
  confirmUnmountOnDelete: 'This share is currently mounted. Unmount it as well?',
  back: 'Back',

  // Summary
  summary: {
    mounted: '{count} mounted',
    errors: '{count} error(s)',
    autoRetry: '{count} auto-retry',
    empty: 'No shares'
  },

  // Status
  status: {
    mounted: 'Mounted',
    disconnected: 'Disconnected',
    error: 'Error',
    pending: 'Connecting...'
  },

  // Actions
  actions: {
    mount: 'Mount',
    unmount: 'Unmount',
    retry: 'Retry',
    openInFinder: 'Open Finder',
    more: 'More actions'
  },

  // Mount Form
  form: {
    name: 'Name',
    server: 'Server Address',
    serverPlaceholder: 'e.g.: FNNAS.local',
    shareName: 'Share Name',
    shareNamePlaceholder: 'e.g.: UNRAID',
    username: 'Username',
    password: 'Password',
    passwordPlaceholderEdit: 'Leave empty to keep original',
    mountPath: 'Mount Path',
    mountPathPlaceholder: '/Users/Shared/SMB',
    autoMount: 'Auto-mount on startup',
    autoRetry: 'Auto-retry on disconnect',
    retryInterval: 'Retry Interval (seconds)',
    addTitle: 'Add Share',
    editTitle: 'Edit Share',
    choose: 'Choose...',
    locationSection: 'Share Location',
    credentialsSection: 'Credentials',
    automationSection: 'Automation',
    chooseMountedShare: 'Choose Mounted Share',
    chooseMountPath: 'Choose Path',
    chooseMountedShareHint: 'Fill server, share name, and path from an SMB share already mounted by the system.',
    chooseMountPathHint: 'Choose the local path this share should use when mounted.'
  },

  // List
  list: {
    emptyTitle: 'No shares',
    emptyHint: 'Add an SMB share to mount and open it from here.'
  },

  // Settings
  settingsPage: {
    title: 'General Settings',
    launchAtLogin: 'Launch at login',
    showNotifications: 'Show notifications',
    defaultMountPath: 'Default mount path',
    checkInterval: 'Status check interval (seconds)',
    language: 'Language',
    languageZh: '中文',
    languageEn: 'English',
    diagnosticMode: 'Diagnostic Mode',
    diagnosticModeHint: 'Writes local diagnostic logs with non-password fields such as server, share, username, and mount path.',
    openDiagnosticLog: 'Open Log File'
  },

  // Import
  import: {
    title: 'Import System Mounts',
    description: 'Detect SMB shares already mounted on the system',
    detected: 'Detected {count} mount(s)',
    noMounts: 'No system SMB mounts detected',
    importSelected: 'Import Selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    name: 'Name',
    server: 'Server',
    share: 'Share',
    path: 'Path'
  },

  // Errors
  errors: {
    mountFailed: 'Mount failed',
    unmountFailed: 'Unmount failed',
    retryFailed: 'Retry failed',
    openInFinderFailed: 'Failed to open in Finder',
    openDiagnosticLogFailed: 'Failed to open diagnostic log'
  }
}

// Type definitions are in index.ts
