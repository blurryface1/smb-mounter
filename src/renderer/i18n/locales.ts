// src/renderer/i18n/locales.ts

export const zh = {
  // 通用
  appName: 'SMB Mounter',
  loading: '加载中...',
  refresh: '刷新状态',
  settings: '设置',
  cancel: '取消',
  save: '保存',
  delete: '删除',
  edit: '编辑',
  add: '添加挂载',
  confirmDelete: '确定要删除这个挂载配置吗？',
  back: '返回',

  // 状态
  status: {
    mounted: '已挂载',
    disconnected: '未连接',
    error: '错误',
    pending: '连接中...'
  },

  // 操作
  actions: {
    mount: '挂载',
    unmount: '卸载',
    retry: '重试'
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
    mountPathPlaceholder: '/Volumes/SMB',
    autoMount: '开机自动挂载',
    autoRetry: '断开自动重试',
    retryInterval: '重试间隔 (秒)',
    addTitle: '添加挂载',
    editTitle: '编辑挂载'
  },

  // 列表
  list: {
    emptyTitle: '暂无挂载配置',
    emptyHint: '点击下方按钮添加'
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
    languageEn: 'English'
  },

  // 错误
  errors: {
    mountFailed: '挂载失败',
    unmountFailed: '卸载失败',
    retryFailed: '重试失败'
  }
}

export const en = {
  // Common
  appName: 'SMB Mounter',
  loading: 'Loading...',
  refresh: 'Refresh Status',
  settings: 'Settings',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add Mount',
  confirmDelete: 'Are you sure you want to delete this mount configuration?',
  back: 'Back',

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
    retry: 'Retry'
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
    mountPathPlaceholder: '/Volumes/SMB',
    autoMount: 'Auto-mount on startup',
    autoRetry: 'Auto-retry on disconnect',
    retryInterval: 'Retry Interval (seconds)',
    addTitle: 'Add Mount',
    editTitle: 'Edit Mount'
  },

  // List
  list: {
    emptyTitle: 'No mount configurations',
    emptyHint: 'Click the button below to add'
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
    languageEn: 'English'
  },

  // Errors
  errors: {
    mountFailed: 'Mount failed',
    unmountFailed: 'Unmount failed',
    retryFailed: 'Retry failed'
  }
}

export type Locale = 'zh' | 'en'
export type LocaleStrings = typeof zh