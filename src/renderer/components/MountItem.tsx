import { useState } from 'react'
import { MountConfig, MountStatus } from '../hooks/useMounts'
import { useI18n } from '../i18n'
import { getMountDetailParts, getPrimaryMountAction, formatErrorSummary } from '../ui/mountPresentation'

interface MountItemProps {
  mount: MountConfig
  status?: MountStatus
  onMount: (id: string) => Promise<void>
  onUnmount: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onEdit: (mount: MountConfig) => void
  onOpenInFinder: (mount: MountConfig) => Promise<void>
  onDelete: (mount: MountConfig) => Promise<void>
}

const statusColors = {
  mounted: 'bg-green-500',
  disconnected: 'bg-gray-400',
  error: 'bg-red-500',
  pending: 'bg-yellow-500 animate-pulse'
}

export default function MountItem({
  mount,
  status,
  onMount,
  onUnmount,
  onRetry,
  onEdit,
  onOpenInFinder,
  onDelete
}: MountItemProps) {
  const { t } = useI18n()
  const [isOperating, setIsOperating] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const currentStatus = status?.status || 'disconnected'
  const primaryAction = getPrimaryMountAction(currentStatus)
  const detailParts = getMountDetailParts(mount, {
    autoMount: t.form.autoMount,
    autoRetry: t.form.autoRetry,
    sharePrefix: t.form.sharePrefix,
    localMountPrefix: t.form.localMountPrefix
  })
  const statusTone = currentStatus === 'mounted'
    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
    : currentStatus === 'error'
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : currentStatus === 'pending'
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'

  const handleMount = async () => {
    setIsOperating(true)
    try {
      await onMount(mount.id)
    } finally {
      setIsOperating(false)
    }
  }

  const handleUnmount = async () => {
    setIsOperating(true)
    try {
      await onUnmount(mount.id)
    } finally {
      setIsOperating(false)
    }
  }

  const handleRetry = async () => {
    setIsOperating(true)
    try {
      await onRetry(mount.id)
    } finally {
      setIsOperating(false)
    }
  }

  const handleOpenInFinder = async () => {
    setIsOperating(true)
    try {
      await onOpenInFinder(mount)
    } finally {
      setIsOperating(false)
    }
  }

  const handleDelete = async () => {
    setShowMoreMenu(false)
    await onDelete(mount)
  }

  const handleEdit = () => {
    setShowMoreMenu(false)
    onEdit(mount)
  }

  const renderPrimaryAction = () => {
    if (primaryAction === 'openInFinder') {
      return (
        <button
          type="button"
          onClick={handleOpenInFinder}
          disabled={isOperating}
          className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {isOperating ? '...' : t.actions.openInFinder}
        </button>
      )
    }

    if (primaryAction === 'retry') {
      return (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isOperating}
          className="px-3 py-1.5 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors disabled:opacity-50 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isOperating ? '...' : t.actions.retry}
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={handleMount}
        disabled={isOperating || currentStatus === 'pending'}
        className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        {isOperating ? '...' : t.actions.mount}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 px-3 py-2.5 hover:border-gray-300 transition-colors dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[currentStatus]}`} />
            <h3 className="font-medium text-sm text-gray-900 truncate dark:text-gray-50">{mount.name}</h3>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusTone}`}>
              {t.status[currentStatus]}
            </span>
          </div>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1 dark:text-gray-400">
            {detailParts.map(part => (
              <span key={part} className="min-w-0 truncate max-w-full">
                {part}
              </span>
            ))}
          </div>

          {status?.errorMessage && (
            <div className="mt-1 text-xs text-red-600 truncate dark:text-red-300">
              {formatErrorSummary(status.errorMessage)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {renderPrimaryAction()}

          {currentStatus === 'mounted' && (
            <button
              type="button"
              onClick={handleUnmount}
              disabled={isOperating}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 flex items-center gap-1.5"
              title={t.actions.unmount}
              aria-label={t.actions.unmount}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t.actions.unmount}
            </button>
          )}

          {/* More menu button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
              title={t.actions.more}
              aria-label={t.actions.more}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* More menu dropdown */}
            {showMoreMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10 dark:bg-gray-900 dark:border-gray-800">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t.delete}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
