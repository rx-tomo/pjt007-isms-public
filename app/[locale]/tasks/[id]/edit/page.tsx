"use client";;
import { use } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { TaskEditorForm } from "@/components/tasks/TaskEditorForm";

export default function EditTaskPage(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  return (
    <DashboardLayout locale={locale}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <TaskEditorForm locale={locale} mode="edit" taskId={id} />
      </div>
    </DashboardLayout>
  );
}
