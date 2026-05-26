import React, { useState } from 'react'
import { MountConfig, MountStatus } from '../hooks/useMounts'

interface MountItemProps {
  mount: MountConfig
  status?: MountStatus
  onMount: (id: string) => Promise<void>
  onUnmount: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
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
  mounted: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
  pending: 'Connecting...'
}

export default function MountItem({
  mount,
  status,
  onMount,
  onUnmount,
  onRetry,
  onEdit,
  onDelete
}: MountItemProps) {
  const [isOperating, setIsOperating] = useState(false)
  const currentStatus = status?.status || 'disconnected'

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

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${mount.name}"?`)) {
      onDelete(mount.id)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColors[currentStatus]}`} />
          <div>
            <h3 className="font-medium text-gray-900">{mount.name}</h3>
            <p className="text-sm text-gray-500">
              {mount.server}/{mount.shareName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            currentStatus === 'mounted' ? 'bg-green-100 text-green-800' :
            currentStatus === 'error' ? 'bg-red-100 text-red-800' :
            currentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {statusLabels[currentStatus]}
          </span>

          <div className="flex items-center gap-1">
            {currentStatus === 'mounted' ? (
              <button
                onClick={handleUnmount}
                disabled={isOperating}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors disabled:opacity-50"
              >
                {isOperating ? '...' : 'Unmount'}
              </button>
            ) : currentStatus === 'error' ? (
              <button
                onClick={handleRetry}
                disabled={isOperating}
                className="px-3 py-1.5 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors disabled:opacity-50"
              >
                {isOperating ? '...' : 'Retry'}
              </button>
            ) : (
              <button
                onClick={handleMount}
                disabled={isOperating || currentStatus === 'pending'}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50"
              >
                {isOperating ? '...' : 'Mount'}
              </button>
            )}

            <button
              onClick={() => onEdit(mount)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {status?.errorMessage && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 rounded px-2 py-1">
          {status.errorMessage}
        </div>
      )}

      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span>Path: {mount.mountPath}</span>
        <span>User: {mount.username}</span>
        {mount.autoMount && <span className="text-blue-600">Auto-mount</span>}
        {mount.autoRetry && <span className="text-orange-600">Auto-retry</span>}
      </div>
    </div>
  )
}