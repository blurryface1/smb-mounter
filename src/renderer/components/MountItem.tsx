import { useState } from 'react'
import { MountConfig, MountStatus } from '../hooks/useMounts'
import { useI18n } from '../i18n'
import { getMountDetailParts, getPrimaryMountAction } from '../ui/mountPresentation'

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
  const currentStatus = status?.status || 'disconnected'
  const primaryAction = getPrimaryMountAction(currentStatus)
  const detailParts = getMountDetailParts(mount, {
    autoMount: t.form.autoMount,
    autoRetry: t.form.autoRetry
  })
  const statusTone = currentStatus === 'mounted'
    ? 'bg-green-100 text-green-700'
    : currentStatus === 'error'
      ? 'bg-red-100 text-red-700'
      : currentStatus === 'pending'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-700'

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
    await onDelete(mount)
  }

  const renderPrimaryAction = () => {
    if (primaryAction === 'openInFinder') {
      return (
        <button
          type="button"
          onClick={handleOpenInFinder}
          disabled={isOperating}
          className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
        >
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
          className="px-3 py-1.5 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors disabled:opacity-50"
        >
          {isOperating ? '...' : t.actions.retry}
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={handleMount}
        disabled={isOperating || currentStatus === 'pending'}
        className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
      >
        {isOperating ? '...' : t.actions.mount}
      </button>
    )
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 px-3 py-2.5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[currentStatus]}`} />
            <h3 className="font-medium text-sm text-gray-900 truncate">{mount.name}</h3>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusTone}`}>
              {t.status[currentStatus]}
            </span>
          </div>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1">
            {detailParts.map(part => (
              <span key={part} className="min-w-0 truncate max-w-full">
                {part}
              </span>
            ))}
          </div>

          {status?.errorMessage && (
            <div className="mt-1 text-xs text-red-600 truncate">
              {status.errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {renderPrimaryAction()}

          {currentStatus === 'mounted' && (
            <button
              type="button"
              onClick={handleUnmount}
              disabled={isOperating}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              title={t.actions.unmount}
              aria-label={t.actions.unmount}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(mount)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title={t.edit}
            aria-label={t.edit}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title={t.delete}
            aria-label={t.delete}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
