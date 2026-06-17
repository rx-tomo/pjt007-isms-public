"use client";;
import { use } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { TaskEditorForm } from "@/components/tasks/TaskEditorForm";

export default function NewTaskPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  return (
    <DashboardLayout locale={locale}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <TaskEditorForm locale={locale} mode="create" />
      </div>
    </DashboardLayout>
  );
}
