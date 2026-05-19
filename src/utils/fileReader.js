// Sequential file reader with per-file bounded retry.
//
// TrueBeam writes to today's log file continuously and the mirror job briefly
// locks files while copying. The previous implementation retried the WHOLE batch
// up to 30 times (60s) whenever any single file failed, which felt like the app
// had hung. Here we instead:
//   - read each file independently
//   - retry only that file a few times with a short backoff
//   - surface persistent failures back to the caller so the UI can ask the user
//     whether to retry the failed ones, skip them, or cancel.

const DEFAULT_RETRY_DELAYS = [300, 800, 2000] // ms between attempts; total ~3.1s/file

function readFileAsTextOnce(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('FileReader error'))
    try {
      reader.readAsText(file)
    } catch (e) {
      reject(e)
    }
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function readFileWithRetry(file, retryDelays = DEFAULT_RETRY_DELAYS) {
  let lastError = null
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const text = await readFileAsTextOnce(file)
      return { ok: true, name: file.name, text, file }
    } catch (err) {
      lastError = err
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt])
      }
    }
  }
  return { ok: false, name: file.name, file, error: lastError }
}

export async function readFilesSequentially(files, { onProgress, retryDelays } = {}) {
  const ok = []
  const failed = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.({
      active: true,
      phase: 'reading',
      current: i,
      total: files.length,
      fileName: file.name,
    })
    // Yield so React can paint the new progress state before the read starts
    await sleep(0)

    const result = await readFileWithRetry(file, retryDelays)
    if (result.ok) {
      ok.push({ name: result.name, text: result.text })
    } else {
      failed.push(result.file)
    }
  }

  onProgress?.({
    active: true,
    phase: 'reading',
    current: files.length,
    total: files.length,
    fileName: '',
  })

  return { ok, failed }
}
