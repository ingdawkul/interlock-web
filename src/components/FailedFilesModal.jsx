import React from 'react'

export default function FailedFilesModal({ failed, okCount, onRetry, onSkip, onCancel }) {
  if (!failed || failed.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">
          Could not read {failed.length} file{failed.length !== 1 ? 's' : ''}
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          These files may currently be in use by another process — for example
          TrueBeam still writing to today's log, or the mirror job copying them
          to the server.
        </p>

        <ul className="text-xs text-gray-700 max-h-40 overflow-auto bg-gray-50 border rounded p-2 mb-4 font-mono">
          {failed.map((f, i) => (
            <li key={i} className="truncate" title={f.name}>{f.name}</li>
          ))}
        </ul>

        {okCount > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            {okCount} other file{okCount !== 1 ? 's were' : ' was'} read successfully and will be processed if you continue.
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          {okCount > 0 && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Skip and continue
            </button>
          )}
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Retry failed
          </button>
        </div>
      </div>
    </div>
  )
}
