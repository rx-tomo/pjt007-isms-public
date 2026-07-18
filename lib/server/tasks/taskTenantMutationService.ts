import { getTaskRepository } from '@/lib/container'
import type {
  ITaskRepository,
  TaskLifecycleAuditContext,
} from '@/lib/db/repositories/interfaces/ITaskRepository'
import type { TenantAuthorizationContext } from '@/lib/server/auth/authorizationContext'
import { TaskImportService, type TaskImportRowRequest } from '@/lib/services/taskImport'
import {
  assertTaskParentDoesNotCycle,
  assertTaskParentChainIsAcyclic,
  assertTaskRelationsBelongToOrganization,
  normalizeTaskCreateInput,
  normalizeTaskUpdateInput,
} from '@/lib/services/taskTenantInvariant'

export class TaskTenantMutationService {
  private repositoryPromise: Promise<ITaskRepository> | null

  constructor(repository?: ITaskRepository) {
    this.repositoryPromise = repository ? Promise.resolve(repository) : null
  }

  private async getRepository(): Promise<ITaskRepository> {
    if (!this.repositoryPromise) {
      this.repositoryPromise = getTaskRepository()
    }
    return this.repositoryPromise
  }

  async createTask(
    authorization: TenantAuthorizationContext,
    body: Record<string, unknown>,
    audit: TaskLifecycleAuditContext
  ) {
    const input = normalizeTaskCreateInput(
      body,
      authorization.organizationId,
      authorization.userId
    )
    const repository = await this.getRepository()
    return repository.createWithTenantInvariant(input, async tx => {
      await assertTaskRelationsBelongToOrganization(tx, authorization.organizationId, input)
      await assertTaskParentChainIsAcyclic(tx, authorization.organizationId, input.parent_task_id)
    }, audit)
  }

  async updateTask(
    authorization: TenantAuthorizationContext,
    taskId: string,
    body: Record<string, unknown>,
    audit: TaskLifecycleAuditContext
  ) {
    const updates = normalizeTaskUpdateInput(body)
    const repository = await this.getRepository()
    if (Object.keys(updates).length === 0) {
      const task = await repository.findByIdAndOrganizationId(
        taskId,
        authorization.organizationId
      )
      return task ? { task, updates } : null
    }

    const updated = await repository.updateWithTenantInvariant(
      taskId,
      authorization.organizationId,
      updates,
      async tx => {
        await assertTaskRelationsBelongToOrganization(tx, authorization.organizationId, updates)
        if (updates.parent_task_id !== undefined) {
          await assertTaskParentChainIsAcyclic(
            tx,
            authorization.organizationId,
            updates.parent_task_id
          )
          await assertTaskParentDoesNotCycle(
            tx,
            authorization.organizationId,
            taskId,
            updates.parent_task_id
          )
        }
      },
      audit
    )
    if (!updated) return null

    const task = await repository.findByIdAndOrganizationId(
      taskId,
      authorization.organizationId
    )
    return task ? { task, updates } : null
  }

  async deleteTask(
    authorization: TenantAuthorizationContext,
    taskId: string,
    audit: TaskLifecycleAuditContext
  ): Promise<void> {
    const repository = await this.getRepository()
    return repository.deleteTaskForTenant(taskId, authorization.organizationId, audit)
  }

  async setTaskTags(
    authorization: TenantAuthorizationContext,
    taskId: string,
    tagIds: string[],
    audit: TaskLifecycleAuditContext
  ): Promise<void> {
    const repository = await this.getRepository()
    return repository.setTaskTagsForTenant(
      taskId,
      authorization.organizationId,
      tagIds,
      audit
    )
  }

  async importTaskRow(request: TaskImportRowRequest) {
    const repository = await this.getRepository()
    return new TaskImportService(repository).importRow(request)
  }
}
