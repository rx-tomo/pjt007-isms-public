"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  TaskService,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
  type TaskWithRelations,
} from "@/lib/services/task";
import { UserService, type UserProfile } from "@/lib/services/user";
import {
  DocumentService,
  type DocumentWithFolder,
} from "@/lib/services/document";
import { RiskService, type RiskWithRelations } from "@/lib/services/risk";
import { canCreateTask, canEditTask } from "@/lib/constants/taskPermissions";
import { useAuth } from "@/lib/hooks/useAuth";

export type TaskEditorMode = "create" | "edit";

interface TaskFormState {
  title: string;
  description: string;
  categoryId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  estimatedHours: string;
  progress: number;
  relatedDocumentId: string;
  relatedRiskId: string;
}

const createInitialState = (): TaskFormState => ({
  title: "",
  description: "",
  categoryId: "",
  assigneeId: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  estimatedHours: "",
  progress: 0,
  relatedDocumentId: "",
  relatedRiskId: "",
});

export interface TaskEditorFormProps {
  locale: string;
  mode: TaskEditorMode;
  taskId?: string;
  onSuccess?: (taskId: string) => void;
}

export function TaskEditorForm({
  locale,
  mode,
  taskId,
  onSuccess,
}: TaskEditorFormProps) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const { user: authUser } = useAuth();
  const taskService = useMemo(() => new TaskService(), []);
  const userService = useMemo(() => new UserService(), []);
  const documentService = useMemo(() => new DocumentService(), []);
  const riskService = useMemo(() => new RiskService(), []);

  const [formData, setFormData] = useState<TaskFormState>(() =>
    createInitialState(),
  );
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [documents, setDocuments] = useState<DocumentWithFolder[]>([]);
  const [risks, setRisks] = useState<RiskWithRelations[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const setFormFromTask = useCallback((task: TaskWithRelations) => {
    setFormData({
      title: task.title,
      description: task.description ?? "",
      categoryId: task.category_id ?? "",
      assigneeId: task.assignee_id ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date ? task.due_date.substring(0, 10) : "",
      estimatedHours: task.estimated_hours?.toString() ?? "",
      progress: task.progress ?? 0,
      relatedDocumentId: task.related_document_id ?? "",
      relatedRiskId: task.related_risk_id ?? "",
    });
  }, []);

  const loadResources = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      if (mode === "edit" && !taskId) {
        throw new Error("missing_task_id");
      }

      const profile = await userService.getUserProfile();
      if (!profile?.organization_id) {
        throw new Error("organization_missing");
      }

      setCurrentRole(profile.role);
      const hasEditPermission =
        mode === "create" ? canCreateTask(profile.role) : canEditTask(profile.role);
      if (!hasEditPermission) {
        setPermissionDenied(true);
        setError(t("errors.permissionDenied"));
        return;
      }

      setPermissionDenied(false);
      setOrganizationId(profile.organization_id);
      setProfileId(profile.id);

      let fetchedCategories = await taskService.getTaskCategories(
        profile.organization_id,
      );
      if (fetchedCategories.length === 0) {
        await taskService.createDefaultTaskCategories(profile.organization_id);
        fetchedCategories = await taskService.getTaskCategories(
          profile.organization_id,
        );
      }
      setCategories(fetchedCategories);

      const [orgUsers, orgDocuments, orgRisks] = await Promise.all([
        userService.getOrganizationUsers(profile.organization_id),
        documentService.getDocuments(profile.organization_id),
        riskService.getRisks(profile.organization_id),
      ]);

      setUsers(orgUsers);
      setDocuments(orgDocuments);
      setRisks(orgRisks);

      if (mode === "edit" && taskId) {
        const existingTask = await taskService.getTaskById(taskId);
        if (!existingTask) {
          throw new Error("task_not_found");
        }
        setFormFromTask(existingTask);
      } else {
        setFormData(createInitialState());
      }
    } catch (err) {
      console.error("[TaskEditorForm] Failed to load form resources", err);
      setError(t(mode === "edit" ? "errors.loadFailed" : "errors.loadFailed"));
    } finally {
      setInitialLoading(false);
    }
  }, [
    documentService,
    mode,
    riskService,
    setFormFromTask,
    t,
    taskId,
    taskService,
    userService,
  ]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const handleChange = <K extends keyof TaskFormState>(
    field: K,
    value: TaskFormState[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "edit" && !taskId) {
      setError(t("errors.loadFailed"));
      return;
    }

    const hasEditPermission =
      mode === "create" ? canCreateTask(currentRole) : canEditTask(currentRole);
    if (!hasEditPermission) {
      setError(t("errors.permissionDenied"));
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        if (!organizationId) {
          throw new Error("organization_missing");
        }

        const reporterId = authUser?.id ?? profileId;
        if (!reporterId) {
          throw new Error("unauthenticated");
        }

        const created = await taskService.createTask({
          title: formData.title,
          description: formData.description || undefined,
          category_id: formData.categoryId || undefined,
          assignee_id: formData.assigneeId || undefined,
          reporter_id: reporterId,
          status: formData.status,
          priority: formData.priority,
          due_date: formData.dueDate || undefined,
          estimated_hours: formData.estimatedHours
            ? parseFloat(formData.estimatedHours)
            : undefined,
          progress: formData.progress,
          related_document_id: formData.relatedDocumentId || undefined,
          related_risk_id: formData.relatedRiskId || undefined,
          organization_id: organizationId,
        });

        if (onSuccess) {
          onSuccess(created.id);
        } else {
          router.push(`/${locale}/tasks`);
        }
      } else if (taskId) {
        await taskService.updateTask(taskId, {
          title: formData.title,
          description: formData.description || undefined,
          category_id: formData.categoryId || undefined,
          assignee_id: formData.assigneeId || undefined,
          status: formData.status,
          priority: formData.priority,
          due_date: formData.dueDate || undefined,
          estimated_hours: formData.estimatedHours
            ? parseFloat(formData.estimatedHours)
            : undefined,
          progress: formData.progress,
          related_document_id: formData.relatedDocumentId || undefined,
          related_risk_id: formData.relatedRiskId || undefined,
        });

        if (onSuccess) {
          onSuccess(taskId);
        } else {
          router.push(`/${locale}/tasks/${taskId}`);
        }
      }
    } catch (err) {
      console.error("[TaskEditorForm] Failed to submit form", err);
      setError(
        t(mode === "create" ? "errors.createFailed" : "errors.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = initialLoading || saving;
  const pageTitle = mode === "create" ? t("list.newTask") : t("list.editTask");
  const cancelHref =
    mode === "create" ? `/${locale}/tasks` : `/${locale}/tasks/${taskId}`;

  if (initialLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-surface-elevated" />
          <div className="h-10 w-full rounded bg-surface-elevated" />
          <div className="h-10 w-full rounded bg-surface-elevated" />
          <div className="h-24 w-full rounded bg-surface-elevated" />
        </div>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-700 shadow-sm">
        <h1 className="text-lg font-semibold">{t("errors.permissionDenied")}</h1>
        <p className="mt-2 text-sm">{t("form.helperText")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-text-primary">{pageTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t("form.helperText")}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {t("form.taskTitle")}
          </label>
          <input
            type="text"
            data-testid="task-title-input"
            value={formData.title}
            onChange={(event) => handleChange("title", event.target.value)}
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            required
            disabled={isDisabled}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {t("form.description")}
          </label>
          <textarea
            rows={4}
            data-testid="task-description-input"
            value={formData.description}
            onChange={(event) =>
              handleChange("description", event.target.value)
            }
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            disabled={isDisabled}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.category")}
            </label>
            <select
              value={formData.categoryId}
              onChange={(event) =>
                handleChange("categoryId", event.target.value)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="">{t("form.selectPlaceholder")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.assignee")}
            </label>
            <select
              data-testid="task-assignee-select"
              value={formData.assigneeId}
              onChange={(event) =>
                handleChange("assigneeId", event.target.value)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="">{t("form.selectPlaceholder")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.status")}
            </label>
            <select
              data-testid="task-status-select"
              value={formData.status}
              onChange={(event) =>
                handleChange("status", event.target.value as TaskStatus)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="todo">{t("list.status.todo")}</option>
              <option value="in_progress">
                {t("list.status.in_progress")}
              </option>
              <option value="review">{t("list.status.review")}</option>
              <option value="done">{t("list.status.done")}</option>
              <option value="cancelled">{t("list.status.cancelled")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.priority")}
            </label>
            <select
              value={formData.priority}
              onChange={(event) =>
                handleChange("priority", event.target.value as TaskPriority)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="low">{t("list.priority.low")}</option>
              <option value="medium">{t("list.priority.medium")}</option>
              <option value="high">{t("list.priority.high")}</option>
              <option value="urgent">{t("list.priority.urgent")}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {t("form.dueDate")}
          </label>
          <input
            type="date"
            data-testid="task-due-date-input"
            value={formData.dueDate}
            onChange={(event) => handleChange("dueDate", event.target.value)}
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            disabled={isDisabled}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.estimatedHours")}
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.estimatedHours}
              onChange={(event) =>
                handleChange("estimatedHours", event.target.value)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.progress")} (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              data-testid="task-progress-input"
              value={formData.progress}
              onChange={(event) => {
                const value = Number(event.target.value);
                handleChange(
                  "progress",
                  Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value)),
                );
              }}
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.relatedDocument")}
            </label>
            <select
              value={formData.relatedDocumentId}
              onChange={(event) =>
                handleChange("relatedDocumentId", event.target.value)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="">{t("form.none")}</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {t("form.relatedRisk")}
            </label>
            <select
              value={formData.relatedRiskId}
              onChange={(event) =>
                handleChange("relatedRiskId", event.target.value)
              }
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              disabled={isDisabled}
            >
              <option value="">{t("form.none")}</option>
              {risks.map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Link
            href={cancelHref}
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
          >
            {t("form.cancel")}
          </Link>
          <button
            type="submit"
            data-testid="task-save-button"
            disabled={isDisabled}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("form.saving") : t("form.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TaskEditorForm;
