"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuditAccess } from "@/lib/hooks/useAuditAccess";
import type {
  AuditReportListItem,
  AuditStatus,
  AuditType,
} from "@/lib/services/audit";
import { FilterBar, type FilterBarItem } from "@/components/filters/FilterBar";
import { StatusFilterBanner } from "@/components/filters/StatusFilterBanner";
import { buildAuditReportFileName } from "@/lib/utils/exporters/auditReportPdf";

const STATUS_OPTIONS: AuditStatus[] = [
  "planning",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];
const AUDIT_TYPE_OPTIONS: AuditType[] = [
  "internal",
  "external",
  "certification",
  "surveillance",
];
const REPORT_CONTENT_FIELDS: (keyof AuditReportListItem["report"])[] = [
  "executive_summary",
  "scope",
  "methodology",
  "positive_findings",
  "improvement_opportunities",
  "conclusion",
];

const formatDate = (value?: string | null, locale?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale ?? "ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const calculateCompletion = (report: AuditReportListItem["report"]) => {
  const filled = REPORT_CONTENT_FIELDS.filter((field) => {
    const raw = report[field];
    if (typeof raw !== "string") return false;
    return raw.trim().length > 0;
  }).length;
  return Math.round((filled / REPORT_CONTENT_FIELDS.length) * 100);
};

export default function AuditReportsPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const t = useTranslations("audit");
  const {
    isAuthorized,
    isLoading: accessLoading,
    error: accessError,
    profile,
  } = useAuditAccess();
  const [reports, setReports] = useState<AuditReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "">("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<AuditType | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/audit?action=reports&organizationId=${encodeURIComponent(profile.organization_id)}`,
      );
      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }
      const data = (await response.json()) as AuditReportListItem[];
      setReports(data);
    } catch (err) {
      console.error("[AuditReports] Failed to load reports", err);
      setError(t("reports.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, t]);

  useEffect(() => {
    if (accessLoading) return;
    if (!isAuthorized) {
      setLoading(false);
      return;
    }
    loadReports();
  }, [accessLoading, isAuthorized, loadReports]);

  const periodOptions = useMemo(() => {
    const values = new Set<string>();
    reports.forEach((item) => {
      if (item.plan.audit_period) {
        values.add(item.plan.audit_period);
      }
    });
    return Array.from(values)
      .sort()
      .map((value) => ({ value, label: value }));
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((entry) => {
      const matchesStatus = statusFilter
        ? entry.plan.status === statusFilter
        : true;
      const matchesPeriod = periodFilter
        ? entry.plan.audit_period === periodFilter
        : true;
      const matchesType = typeFilter
        ? entry.plan.audit_type === typeFilter
        : true;
      const matchesSearch = searchQuery
        ? entry.plan.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchesStatus && matchesPeriod && matchesType && matchesSearch;
    });
  }, [periodFilter, reports, searchQuery, statusFilter, typeFilter]);

  const filterBarItems = useMemo<FilterBarItem[]>(() => {
    const items: FilterBarItem[] = [
      {
        key: "search",
        type: "search",
        placeholder: t("reports.filters.search"),
        value: searchQuery,
        onChange: setSearchQuery,
      },
      {
        key: "status",
        type: "select",
        placeholder: t("reports.filters.status"),
        value: statusFilter,
        onChange: (value) => setStatusFilter(value as AuditStatus | ""),
        options: STATUS_OPTIONS.map((status) => ({
          value: status,
          label: t(`plans.status.${status}`),
        })),
      },
      {
        key: "period",
        type: "select",
        placeholder: t("reports.filters.period"),
        value: periodFilter,
        onChange: setPeriodFilter,
        options: periodOptions,
      },
      {
        key: "type",
        type: "select",
        placeholder: t("reports.filters.type"),
        value: typeFilter,
        onChange: (value) => setTypeFilter(value as AuditType | ""),
        options: AUDIT_TYPE_OPTIONS.map((option) => ({
          value: option,
          label: t(`reports.typeLabels.${option}` as const),
        })),
      },
    ];
    return items;
  }, [periodFilter, periodOptions, searchQuery, statusFilter, t, typeFilter]);

  const activeFilterBanners = [
    statusFilter && {
      key: "status",
      label: t("plans.activeFilters.status", {
        status: t(`plans.status.${statusFilter}`),
      }),
      onClear: () => setStatusFilter(""),
    },
    periodFilter && {
      key: "period",
      label: t("plans.activeFilters.period", { period: periodFilter }),
      onClear: () => setPeriodFilter(""),
    },
    typeFilter && {
      key: "type",
      label: t("reports.banners.type", {
        type: t(`reports.typeLabels.${typeFilter}` as const),
      }),
      onClear: () => setTypeFilter(""),
    },
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[];

  const stats = useMemo(() => {
    const total = reports.length;
    const completed = reports.filter(
      (item) => item.plan.status === "completed",
    ).length;
    const inProgress = reports.filter(
      (item) =>
        item.plan.status === "in_progress" || item.plan.status === "scheduled",
    ).length;
    return { total, completed, inProgress };
  }, [reports]);

  const handleDownload = useCallback(
    async (item: AuditReportListItem) => {
      if (!item.report.id) return;
      setDownloadingId(item.report.id);
      try {
        const response = await fetch(
          `/api/audit/reports/${item.report.id}/export`,
        );
        if (!response.ok) throw new Error("download_failed");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${buildAuditReportFileName(item.plan.title, item.report.report_date)}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error("[AuditReports] Failed to download report", err);
        setError(t("reports.errors.downloadFailed"));
      } finally {
        setDownloadingId(null);
      }
    },
    [t],
  );

  const renderAccessDenied = () => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="font-semibold">{t("accessDenied.title")}</p>
      <p className="mt-2">
        {accessError === "permission_fetch_failed"
          ? t("accessDenied.permissionFetchFailed")
          : t("accessDenied.description")}
      </p>
    </div>
  );

  const renderEmptyState = () => (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-base font-semibold text-text-primary">
        {t("reports.empty.title")}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        {t("reports.empty.description")}
      </p>
      <Link
        href={`/${locale}/audit/plans/new`}
        className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t("reports.empty.cta")}
      </Link>
    </div>
  );

  const renderTable = () => (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-app text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-6 py-3">{t("reports.table.columns.report")}</th>
            <th className="px-6 py-3">{t("reports.table.columns.period")}</th>
            <th className="px-6 py-3">{t("reports.table.columns.status")}</th>
            <th className="px-6 py-3">{t("reports.table.columns.owner")}</th>
            <th className="px-6 py-3">{t("reports.table.columns.updated")}</th>
            <th className="px-6 py-3 text-right">
              {t("reports.table.columns.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredReports.map((item) => {
            const completion = calculateCompletion(item.report);
            return (
              <tr key={item.report.id} className="hover:bg-surface-hover/60">
                <td className="px-6 py-4 align-top">
                  <div className="font-semibold text-text-primary">
                    {item.plan.title}
                  </div>
                  <p className="text-xs text-text-muted">
                    {t("reports.table.reportDate", {
                      date: formatDate(item.report.report_date, locale),
                    })}
                  </p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                    {t("reports.badges.completion", { percent: completion })}
                  </span>
                </td>
                <td className="px-6 py-4 align-top text-text-secondary">
                  {item.plan.audit_period || "-"}
                </td>
                <td className="px-6 py-4 align-top">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {t(`plans.status.${item.plan.status}`)}
                  </span>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="text-text-primary">
                    {item.plan.lead_auditor?.full_name ||
                      item.plan.lead_auditor?.email ||
                      "-"}
                  </div>
                  <p className="text-xs text-text-muted">
                    {item.report.approved_by
                      ? t("reports.table.approvedBy", {
                          name: item.report.approved_by,
                        })
                      : t("reports.table.awaitingApproval")}
                  </p>
                </td>
                <td className="px-6 py-4 align-top text-text-secondary">
                  {formatDate(
                    item.report.updated_at ?? item.plan.updated_at,
                    locale,
                  )}
                </td>
                <td className="px-6 py-4 align-top text-right">
                  <div className="flex flex-col gap-2 text-xs">
                    <Link
                      href={`/${locale}/audit/plans/${item.plan.id}`}
                      className="inline-flex items-center justify-end text-blue-600 hover:underline"
                    >
                      {t("reports.actions.viewPlan")}
                    </Link>
                    <Link
                      href={`/${locale}/audit/plans/${item.plan.id}/report`}
                      className="inline-flex items-center justify-end text-blue-600 hover:underline"
                    >
                      {t("reports.actions.editReport")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={
                        !item.report.id || downloadingId === item.report.id
                      }
                      className="inline-flex items-center justify-end text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                      {downloadingId === item.report.id
                        ? t("report.actions.downloading")
                        : t("reports.actions.downloadPdf")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <DashboardLayout locale={locale}>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {!isAuthorized && !accessLoading ? (
          renderAccessDenied()
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-text-primary">
                    {t("reports.title")}
                  </h1>
                  <p className="mt-2 text-sm text-text-secondary">
                    {t("reports.description")}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-center text-xs text-text-secondary">
                  <div>
                    <dt>{t("reports.stats.total")}</dt>
                    <dd className="text-lg font-semibold text-text-primary">
                      {stats.total}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("reports.stats.completed")}</dt>
                    <dd className="text-lg font-semibold text-text-primary">
                      {stats.completed}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("reports.stats.inProgress")}</dt>
                    <dd className="text-lg font-semibold text-text-primary">
                      {stats.inProgress}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <FilterBar items={filterBarItems} />

            {activeFilterBanners.map((banner) => (
              <StatusFilterBanner
                key={banner.key}
                label={banner.label}
                clearLabel={t("plans.activeFilters.clear")}
                onClear={banner.onClear}
              />
            ))}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-40 rounded bg-surface-hover" />
                  <div className="h-4 w-full rounded bg-surface-hover" />
                  <div className="h-4 w-5/6 rounded bg-surface-hover" />
                  <div className="h-4 w-2/3 rounded bg-surface-hover" />
                </div>
              </div>
            ) : filteredReports.length === 0 ? (
              renderEmptyState()
            ) : (
              renderTable()
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
