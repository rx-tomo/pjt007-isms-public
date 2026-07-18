export type LimitedFormDataResult =
  | { ok: true; formData: FormData; bytesRead: number }
  | { ok: false; reason: 'too_large' | 'invalid_content_length' | 'invalid_form_data' }

function parseContentLength(value: string | null): number | null | 'invalid' {
  if (value === null) return null
  if (!/^\d+$/.test(value)) return 'invalid'
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 'invalid'
}

export async function parseLimitedFormData(
  request: Request,
  maxBytes: number
): Promise<LimitedFormDataResult> {
  const contentLength = parseContentLength(request.headers.get('content-length'))
  if (contentLength === 'invalid') return { ok: false, reason: 'invalid_content_length' }
  if (contentLength !== null && contentLength > maxBytes) {
    return { ok: false, reason: 'too_large' }
  }

  if (!request.body) return { ok: false, reason: 'invalid_form_data' }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let bytesRead = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > maxBytes) {
        await reader.cancel('request body too large')
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: 'invalid_form_data' }
  }

  const body = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  const headers = new Headers(request.headers)
  headers.delete('content-length')
  headers.delete('transfer-encoding')

  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body,
    })
    return {
      ok: true,
      formData: await boundedRequest.formData(),
      bytesRead,
    }
  } catch {
    return { ok: false, reason: 'invalid_form_data' }
  }
}
