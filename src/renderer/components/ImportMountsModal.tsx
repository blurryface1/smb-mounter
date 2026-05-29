import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'

interface DetectedMount {
  server: string
  shareName: string
  username: string
  mountPath: string
}

interface ImportMountsModalProps {
  onImport: (mounts: DetectedMount[]) => void
  onClose: () => void
}

export default function ImportMountsModal({ onImport, onClose }: ImportMountsModalProps) {
  const { t } = useI18n()
  const [mounts, setMounts] = useState<DetectedMount[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.detectSystemMounts().then((detected: DetectedMount[]) => {
      setMounts(detected)
      setLoading(false)
    })
  }, [])

  const toggleSelect = (index: number) => {
    const next = new Set(selected)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setSelected(next)
  }

  const selectAll = () => {
    setSelected(new Set(mounts.map((_, i) => i)))
  }

  const deselectAll = () => {
    setSelected(new Set())
  }

  const handleImport = () => {
    const toImport = mounts.filter((_, i) => selected.has(i))
    onImport(toImport)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t.import.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <p className="text-sm text-gray-600">{t.import.description}</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t.loading}</div>
          ) : mounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t.import.noMounts}</div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-3">
                {t.import.detected.replace('{count}', String(mounts.length))}
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">
                  {t.import.selectAll}
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAll} className="text-sm text-blue-600 hover:text-blue-700">
                  {t.import.deselectAll}
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 text-left w-10"></th>
                    <th className="py-2 text-left">{t.import.server}</th>
                    <th className="py-2 text-left">{t.import.share}</th>
                    <th className="py-2 text-left">{t.import.path}</th>
                  </tr>
                </thead>
                <tbody>
                  {mounts.map((mount, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelect(i)}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleSelect(i)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2">{mount.server}</td>
                      <td className="py-2">{mount.shareName}</td>
                      <td className="py-2 font-mono text-xs">{mount.mountPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleImport}
            disabled={selected.size === 0}
            className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
          >
            {t.import.importSelected} ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
