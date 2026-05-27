import React from 'react'
import { MountConfig, MountStatus } from '../hooks/useMounts'
import MountItem from './MountItem'
import { useI18n } from '../i18n'

interface MountListProps {
  mounts: MountConfig[]
  statuses: Map<string, MountStatus>
  loading: boolean
  onMount: (id: string) => Promise<void>
  onUnmount: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onEdit: (mount: MountConfig) => void
  onDelete: (id: string) => void
}

export default function MountList({
  mounts,
  statuses,
  loading,
  onMount,
  onUnmount,
  onRetry,
  onEdit,
  onDelete
}: MountListProps) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (mounts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">{t.list.emptyTitle}</h3>
        <p className="mt-1 text-sm text-gray-500">{t.list.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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