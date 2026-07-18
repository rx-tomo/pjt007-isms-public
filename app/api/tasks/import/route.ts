import { NextRequest, NextResponse } from 'next/server'
import { getRouteAuth } from '@/lib/server/auth/routeAuth'
import { requireServiceRole } from '@/lib/server/auth/secureClient'
import { parseLimitedFormData } from '@/lib/server/http/limitedFormData'
import { parseCsvToObjects } from '@/lib/utils/importers/csv'
import { TaskTenantMutationService } from '@/lib/server/tasks/taskTenantMutationService'
import {
  getTaskImportMaxFileSizeBytes,
  getTaskImportMaxRequestSizeBytes,
  isTaskImportRowError,
  TASK_IMPORT_MAX_CELL_LENGTH,
  TASK_IMPORT_MAX_COLUMNS,
  TASK_IMPORT_MAX_ROWS,
  TASK_IMPORT_MAX_TOTAL_CELLS,
} from '@/lib/services/taskImport'

export const runtime = 'nodejs'

type SummaryBlock = {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: string[]
  omittedErrors: number
}

const MAX_DETAILED_ERRORS = 100

function formDataError(reason: 'too_large' | 'invalid_content_length' | 'invalid_form_data') {
  if (reason === 'too_large') {
    return NextResponse.json({ error: 'Import request is too large' }, { status: 413 })
  }
  return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
}

function addSummaryError(summary: SummaryBlock, message: string): void {
  if (summary.errors.length < MAX_DETAILED_ERRORS) {
    summary.errors.push(message)
  } else {
    summary.omittedErrors += 1
  }
}

export async function POST(request: NextRequest) {
  const { user, applyCookies } = await getRouteAuth(request)
  const respond = <T extends NextResponse>(response: T): T => applyCookies(response)

  if (!user) {
    return respond(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const limitedFormData = await parseLimitedFormData(
    request,
    getTaskImportMaxRequestSizeBytes()
  )
  if (!limitedFormData.ok) return respond(formDataError(limitedFormData.reason))

  const file = limitedFormData.formData.get('file')
  const organizationEntry = limitedFormData.formData.get('organizationId')
  const organizationId = typeof organizationEntry === 'string'
    ? organizationEntry.trim()
    : ''

  if (!(file instanceof Blob)) {
    return respond(NextResponse.json({ error: 'file is required' }, { status: 400 }))
  }
  const fileName = typeof (file as Blob & { name?: unknown }).name === 'string'
    ? String((file as Blob & { name: string }).name)
    : ''
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return respond(NextResponse.json({ error: 'A .csv file is required' }, { status: 400 }))
  }
  if (file.size > getTaskImportMaxFileSizeBytes()) {
    return respond(NextResponse.json({ error: 'CSV file is too large' }, { status: 413 }))
  }
  if (!organizationId) {
    return respond(NextResponse.json({ error: 'organizationId is required' }, { status: 400 }))
  }

  const { guard, error } = await requireServiceRole(request, {
    mode: 'tenant',
    allowedRoles: ['org_admin', 'system_operator'],
    organizationId,
    actionName: 'tasks.import'
  })

  if (error || !guard) {
    return respond(error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { logEvent, json, userId } = guard
  const summary: SummaryBlock = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    omittedErrors: 0,
  }

  let rows: ReturnType<typeof parseCsvToObjects>
  try {
    rows = parseCsvToObjects(await file.arrayBuffer(), ['title'], {
      strictColumnCount: true,
      strictQuoteSyntax: true,
      maxColumns: TASK_IMPORT_MAX_COLUMNS,
      maxRows: TASK_IMPORT_MAX_ROWS,
      maxCellLength: TASK_IMPORT_MAX_CELL_LENGTH,
      maxTotalCells: TASK_IMPORT_MAX_TOTAL_CELLS,
    })
    if (rows.length > TASK_IMPORT_MAX_ROWS) {
      return respond(NextResponse.json({ error: 'CSV contains too many rows' }, { status: 400 }))
    }
    if (rows.some(row => Object.values(row).some(value => (
      value.length > TASK_IMPORT_MAX_CELL_LENGTH
    )))) {
      return respond(NextResponse.json(
        { error: 'CSV contains a cell that is too long' },
        { status: 400 }
      ))
    }
  } catch (parseError) {
    console.warn('[tasks/import] invalid CSV', parseError)
    return respond(NextResponse.json({ error: 'Invalid CSV file' }, { status: 400 }))
  }

  const taskService = new TaskTenantMutationService()
  try {
    for (let index = 0; index < rows.length; index += 1) {
      const lineNumber = index + 2
      summary.processed += 1

      try {
        const result = await taskService.importTaskRow({
          organizationId,
          reporterId: userId,
          row: rows[index]!,
        })
        if (result.action === 'created') summary.created += 1
        else summary.updated += 1
      } catch (rowError) {
        summary.skipped += 1
        if (isTaskImportRowError(rowError)) {
          addSummaryError(summary, `Line ${lineNumber}: ${rowError.message}`)
        } else {
          console.error('[tasks/import] row import failed', {
            organizationId,
            lineNumber,
            error: rowError,
          })
          addSummaryError(summary, `Line ${lineNumber}: failed to import row`)
        }
      }
    }

    await logEvent('success', { summary })
    return respond(json({ message: 'Import completed', summary }))
  } catch (error) {
    console.error('[tasks/import] failed', error)
    try {
      await logEvent('error', { reason: 'task_import_failed' })
    } catch (auditError) {
      console.error('[tasks/import] failed to record audit event', auditError)
    }
    return respond(NextResponse.json({ error: 'Failed to import tasks' }, { status: 500 }))
  }
}
