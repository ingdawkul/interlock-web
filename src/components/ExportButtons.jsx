import React from 'react'
import { saveAs } from 'file-saver'


export function exportTxt(results, meta = {}) {
  let txt = `Analyserte filer: ${meta.fileCount || 0}\n`
  txt += `Analyserte linjer: ${meta.totalLines || 0}\nVarsler: ${meta.matchLines || 0}\nUnike interlocks: ${Object.keys(results).length}\n\n`
  for (const [id, data] of Object.entries(results)) {
    txt += `${id}\tTotalt: ${data.total}\n`
    for (const e of data.entries) {
      txt += ` -> ${e.Type}\t${e.description}\n Klokkeslett: ${e.Times.join(', ')}\n`
    }
    txt += '\n'
  }
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, 'unique_interlocks.txt')
}

export default function ExportButtons({ results, meta }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportTxt(results, meta)}
        className="px-3 py-2 rounded font-semibold transition-colors"
        style={{
          backgroundColor: 'var(--btn-secondary)',
          color: 'var(--text-primary)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary)'}
      >
        Eksporter til TXT
      </button>

      <button
        onClick={() => exportXlsx(results, meta)}
        className="px-3 py-2 rounded font-semibold transition-colors"
        style={{
          backgroundColor: 'var(--btn-primary)',
          color: 'var(--text-primary)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary)'}
      >
        Eksporter til Excel
      </button>
    </div>
  )
}
