'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserService, type UserRole } from '@/lib/services/user';
import { useAuditAccess } from '@/lib/hooks/useAuditAccess';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { PUBLIC_REPOSITORY_ISSUES_URL, PUBLIC_REPOSITORY_URL } from '@/lib/publicLinks';

const AUTO_COLLAPSE_ROUTES = new Set(['documents', 'risks', 'tasks', 'incidents', 'audit', 'approvals', 'education', 'management-reviews', 'suppliers', 'bcp']);
const SIDEBAR_COLLAPSED_KEY = 'dashboard:sidebar-collapsed';
const SIDEBAR_MANUAL_KEY = 'dashboard:sidebar-manual';
const SIDEBAR_OVERLAY_MARGIN = 12;

const readBooleanFromStorage = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
};

const writeBooleanToStorage = (key: string, value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage might be unavailable (e.g., Safari private mode). Ignore errors.
  }
};
type DashboardTranslate = ReturnType<typeof useTranslations>;

interface HeaderSummaryProps {
  name?: string | null;
  organizationName?: string | null;
  role?: string | null;
}

type OrganizationSwitchOption = {
  id: string;
  name: string;
  isms_phase?: 'initial' | 'surveillance' | null;
};

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  submenu?: { name: string; href: string }[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  locale: string;
  headerSummary?: HeaderSummaryProps;
}

function buildSuperAdminNavigation(locale: string, t: DashboardTranslate): NavigationItem[] {
  const withLocale = (path: string) => `/${locale}${path}`;
  return [
    {
      name: t('common.superAdminNav.organizations'),
      href: withLocale('/super-admin/organizations'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V7a2 2 0 012-2h4V3h6v2h4a2 2 0 012 2v14H3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21V11h6v10" />
        </svg>
      )
    },
    {
      name: t('common.superAdminNav.invitations'),
      href: withLocale('/super-admin/invitations'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m-4 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
      )
    },
    {
      name: t('common.superAdminNav.users'),
      href: withLocale('/super-admin/users'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A7 7 0 0112 15a7 7 0 016.879 2.804M15 11a3 3 0 10-6 0 3 3 0 006 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 11h3m-1.5-1.5v3" />
        </svg>
      )
    },
    {
      name: t('common.superAdminNav.logs'),
      href: withLocale('/super-admin/logs'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      )
    },
    {
      name: t('common.superAdminNav.serviceSettings'),
      href: withLocale('/super-admin/settings'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.37 2.37 1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573 1.724 1.724 0 01-2.37 2.37 1.724 1.724 0 00-2.573 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.37-2.37 1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35A1.724 1.724 0 015.4 7.753a1.724 1.724 0 012.37-2.37 1.724 1.724 0 002.555-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, locale, headerSummary }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hasManualSidebarOverride, setHasManualSidebarOverride] = useState(false);
  const [isSidebarPreferenceLoaded, setIsSidebarPreferenceLoaded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoverOverlay, setHoverOverlay] = useState<{
    item: NavigationItem;
    triggerTop: number;
    triggerHeight: number;
  } | null>(null);
  const [overlayTop, setOverlayTop] = useState<number>(SIDEBAR_OVERLAY_MARGIN);
  const [autoSummary, setAutoSummary] = useState<HeaderSummaryProps | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuPanelRef = useRef<HTMLDivElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationSwitchOption[]>([]);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const [organizationSwitchError, setOrganizationSwitchError] = useState<string | null>(null);
  // Auth client は signOut 時に動的importで取得
  const userMenuPanelId = 'dashboard-user-menu-panel';
  const userMenuButtonId = 'dashboard-user-menu-button';
  const showDevLoginLink = process.env.NODE_ENV !== 'production';
  const mainContentId = useId();

  const { isAuthorized: auditAuthorized, isLoading: auditAccessLoading } = useAuditAccess();

  // Breadcrumb generation
  const breadcrumbLabels = (t.raw('common.breadcrumbs') as Record<string, string> | undefined) ?? {};
  const homeLabel = breadcrumbLabels.home ?? t('common.home');

  const formatSegment = (segment: string) => {
    const decoded = decodeURIComponent(segment).replace(/-/g, ' ');
    if (!decoded) return segment;
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  };

  const resolveBreadcrumbLabel = (segment: string) => {
    const normalized = segment.replace(/-/g, '_');
    return (
      breadcrumbLabels[normalized] ??
      breadcrumbLabels[segment] ??
      formatSegment(segment)
    );
  };

  const getInitial = (value?: string | null) => {
    if (!value) return null;
    const initial = value.trim().charAt(0);
    return initial ? initial.toUpperCase() : null;
  };

  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [
        {
          name: homeLabel,
          href: `/${locale}/home`,
          current: true,
        },
      ];
    }

    const [maybeLocale, ...rest] = segments;
    const pathSegments = maybeLocale === locale ? rest : segments;
    const breadcrumbSegments = pathSegments.length > 0 ? pathSegments : ['home'];

    let accumulatedPath = `/${locale}`;
    const computed = breadcrumbSegments.map((segment, index) => {
      accumulatedPath += `/${segment}`;
      const name = segment === 'home' ? homeLabel : resolveBreadcrumbLabel(segment);
      return {
        name,
        href: accumulatedPath,
        current: index === breadcrumbSegments.length - 1,
      };
    });

    if (computed.length > 0 && breadcrumbSegments[0] === 'home') {
      computed[0] = { ...computed[0], name: homeLabel };
    }

    return computed;
  };

  const breadcrumbs = generateBreadcrumbs();

  const roleLabels = (t.raw('common.roles') as Record<string, string> | undefined) ?? {};

  const summary = headerSummary ?? autoSummary;
  const summaryName = summary?.name ?? null;
  const summaryOrganization = summary?.organizationName ?? null;
  const summaryRoleKey = summary?.role ?? null;

  const summaryRoleLabel = summaryRoleKey ? (roleLabels?.[summaryRoleKey] ?? formatSegment(summaryRoleKey)) : null;
  const menuLabel = summaryName ?? t('common.currentUser');
  const secondaryLabel = summaryOrganization && summaryRoleLabel
    ? `${summaryOrganization} · ${summaryRoleLabel}`
    : summaryOrganization ?? summaryRoleLabel ?? null;
  const summaryInitial = getInitial(summaryName) ?? getInitial(summaryOrganization) ?? 'U';
  const phaseLabels = (t.raw('common.tenantSwitch.phases') as Record<string, string> | undefined) ?? {};
  const shouldShowOrganizationSwitch = summaryRoleKey === 'system_operator' && availableOrganizations.length > 1;

  const navigationItems: NavigationItem[] = React.useMemo(() => {
    if (summaryRoleKey === 'super_admin') {
      return buildSuperAdminNavigation(locale, t);
    }

    const items: NavigationItem[] = [
      {
        name: t('common.home'),
        href: `/${locale}/home`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        ),
      },
      {
        name: t('common.documents'),
        href: `/${locale}/documents`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        ),
      },
      {
        name: t('common.riskAssessment'),
        href: `/${locale}/risks`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        ),
      },
      {
        name: t('common.tasks'),
        href: `/${locale}/tasks`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        ),
      },
      {
        name: t('common.incidents'),
        href: `/${locale}/incidents`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.7-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
        ),
      },
      {
        name: t('common.audit'),
        href: `/${locale}/audit`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        ),
      },
      {
        name: t('common.education'),
        href: `/${locale}/education`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 20v-7.5l4-2.222" />
          </svg>
        ),
      },
      {
        name: t('common.managementReviews'),
        href: `/${locale}/management-reviews`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        name: t('common.suppliers'),
        href: `/${locale}/suppliers`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        name: t('common.bcp'),
        href: `/${locale}/bcp`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        name: t('common.quickActions.viewPendingApprovals'),
        href: `/${locale}/approvals`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        name: t('common.settings'),
        href: `/${locale}/settings/profile`,
        icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      submenu: [
        { name: t('common.profile'), href: `/${locale}/settings/profile` },
        { name: t('common.organization'), href: `/${locale}/settings/organization` },
        { name: t('common.users'), href: `/${locale}/settings/users` },
        { name: t('settings.structure.title'), href: `/${locale}/settings/structure` },
        ...(summaryRoleKey && ['system_operator', 'org_admin'].includes(summaryRoleKey) ? [{ name: t('common.initialSetup'), href: `/${locale}/settings/setup` }] : []),
      ]
      },
    ];

    // RBAC: filter new modules by role
    const role = summaryRoleKey;
    let filteredItems = items;

    if (role === 'user' || role === 'approver') {
      // user/approver: only see education (not management-reviews, suppliers, bcp)
      const hiddenPaths = new Set([
        `/${locale}/management-reviews`,
        `/${locale}/suppliers`,
        `/${locale}/bcp`,
      ]);
      filteredItems = filteredItems.filter(item => !hiddenPaths.has(item.href));
    } else if (role === 'auditor') {
      // auditor: see education, management-reviews, bcp but NOT suppliers
      const hiddenPaths = new Set([
        `/${locale}/suppliers`,
      ]);
      filteredItems = filteredItems.filter(item => !hiddenPaths.has(item.href));
    }

    if (auditAuthorized === false && !auditAccessLoading) {
      return filteredItems.filter(item => item.href !== `/${locale}/audit`);
    }

    return filteredItems;
  }, [auditAuthorized, auditAccessLoading, locale, summaryRoleKey, t]);

  const userMenuItems = React.useMemo(() => {
    const items: { id: string; label: string; href: string; icon: React.ReactNode }[] = [
      {
        id: 'profile',
        label: t('common.profile'),
        href: `/${locale}/settings/profile`,
        icon: (
          <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A8 8 0 1118.879 17.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        id: 'notifications',
        label: t('common.notifications'),
        href: `/${locale}/notifications`,
        icon: (
          <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
    ];

    if (showDevLoginLink) {
      items.push({
        id: 'dev-login',
        label: t('common.devLogin'),
        href: `/${locale}/dev-login`,
        icon: (
          <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        ),
      });
    }

    return items;
  }, [locale, showDevLoginLink, t]);

  const closeUserMenu = useCallback((options: { focusButton?: boolean } = {}) => {
    setIsUserMenuOpen(false);
    if (options.focusButton !== false) {
      userMenuButtonRef.current?.focus();
    }
  }, []);

  const handleUserMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsUserMenuOpen((prev) => !prev);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsUserMenuOpen(true);
    }
  };

  const handleUserMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !isUserMenuOpen) {
      return;
    }

    const focusableItems = userMenuPanelRef.current
      ? Array.from(userMenuPanelRef.current.querySelectorAll<HTMLElement>('[data-user-menu-item]'))
      : [];

    if (focusableItems.length === 0) {
      return;
    }

    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (!event.shiftKey && activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }

    if (event.shiftKey && activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    }
  };

  const handleSignOut = async () => {
    try {
      const { authClient } = await import('@/lib/auth/auth-client');
      await authClient.signOut();
    } catch (error) {
      // Intentionally swallow: 上位コンポーネントでの通知は別途検討
    } finally {
      closeUserMenu();
      router.push(`/${locale}/auth/login`);
    }
  };

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const focusFirstItem = () => {
      requestAnimationFrame(() => {
        const firstItem = userMenuPanelRef.current?.querySelector<HTMLElement>('[data-user-menu-item]');
        firstItem?.focus();
      });
    };

    focusFirstItem();

    const handlePointerDown = (event: PointerEvent) => {
      const panel = userMenuPanelRef.current;
      const button = userMenuButtonRef.current;
      const target = event.target as Node;
      if (!panel || panel.contains(target)) {
        return;
      }
      if (button && button.contains(target)) {
        return;
      }
      closeUserMenu({ focusButton: false });
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeUserMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [closeUserMenu, isUserMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const userService = new UserService();

    async function loadHeaderSummary() {
      try {
        const user = headerSummary ? null : await userService.getCurrentUser();
        if (!headerSummary && (!user || cancelled)) return;

        const organizationResponse = await fetch('/api/auth/organization', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }).catch(() => null);
        const organizationPayload = organizationResponse?.ok
          ? await organizationResponse.json().catch(() => ({}))
          : {};
        const organization = organizationPayload.organization ?? null;
        const organizations = Array.isArray(organizationPayload.organizations)
          ? organizationPayload.organizations as OrganizationSwitchOption[]
          : [];
        if (cancelled) return;

        if (headerSummary) {
          setAutoSummary(null);
        } else {
          setAutoSummary({
            name: user?.full_name ?? user?.email ?? null,
            organizationName: organization?.name ?? null,
            role: user?.role ?? null
          });
        }
        setActiveOrganizationId(organization?.id ?? null);
        setAvailableOrganizations(organizations);
      } catch (error) {
        if (!cancelled) {
          setAutoSummary(null);
          setActiveOrganizationId(null);
          setAvailableOrganizations([]);
        }
      }
    }

    loadHeaderSummary();

    return () => {
      cancelled = true;
    };
  }, [headerSummary]);

  useEffect(() => {
    const isCollapsed = readBooleanFromStorage(SIDEBAR_COLLAPSED_KEY, false);
    setIsSidebarOpen(!isCollapsed);
    setHasManualSidebarOverride(readBooleanFromStorage(SIDEBAR_MANUAL_KEY, false));
    setIsSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!isSidebarPreferenceLoaded) return;
    writeBooleanToStorage(SIDEBAR_COLLAPSED_KEY, !isSidebarOpen);
  }, [isSidebarOpen, isSidebarPreferenceLoaded]);

  useEffect(() => {
    if (!isSidebarPreferenceLoaded) return;
    writeBooleanToStorage(SIDEBAR_MANUAL_KEY, hasManualSidebarOverride);
  }, [hasManualSidebarOverride, isSidebarPreferenceLoaded]);

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    const adjustedSegments = segments[0] === locale ? segments.slice(1) : segments;
    const routeKey = adjustedSegments[0] ?? '';
    const shouldCollapse = adjustedSegments.length >= 3 || AUTO_COLLAPSE_ROUTES.has(routeKey);

    if (shouldCollapse && isSidebarOpen && !hasManualSidebarOverride) {
      setIsSidebarOpen(false);
    }
  }, [pathname, locale, isSidebarOpen, hasManualSidebarOverride]);

  useEffect(() => {
    if (isSidebarOpen) {
      setHoverOverlay(null);
      setOverlayTop(SIDEBAR_OVERLAY_MARGIN);
    }
  }, [isSidebarOpen]);

  useLayoutEffect(() => {
    if (!hoverOverlay || !sidebarRef.current) {
      setOverlayTop(SIDEBAR_OVERLAY_MARGIN);
      return;
    }

    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const overlayHeight = hoverCardRef.current?.getBoundingClientRect().height ?? 0;
    const sidebarHeight = sidebarRect.height;
    const targetCenter = hoverOverlay.triggerTop + hoverOverlay.triggerHeight / 2;
    const halfOverlay = overlayHeight / 2;
    const desiredTop = targetCenter - halfOverlay;
    const maxTop = Math.max(SIDEBAR_OVERLAY_MARGIN, sidebarHeight - overlayHeight - SIDEBAR_OVERLAY_MARGIN);
    const clampedTop = Math.max(SIDEBAR_OVERLAY_MARGIN, Math.min(desiredTop, maxTop));

    setOverlayTop(Number.isFinite(clampedTop) ? clampedTop : SIDEBAR_OVERLAY_MARGIN);
  }, [hoverOverlay]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [pathname]);

  const showCollapsedOverlay = (target: HTMLElement, item: NavigationItem) => {
    if (isSidebarOpen) return;
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) return;

    const sidebarRect = sidebarElement.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    const scrollTop = sidebarElement.scrollTop ?? 0;
    const triggerTop = itemRect.top - sidebarRect.top + scrollTop;

    setOverlayTop(triggerTop);
    setHoverOverlay({
      item,
      triggerTop,
      triggerHeight: itemRect.height,
    });
  };

  const handleCollapsedLeave = () => {
    setHoverOverlay(null);
    setOverlayTop(SIDEBAR_OVERLAY_MARGIN);
  };

  const toggleSidebar = () => {
    const next = !isSidebarOpen;
    setIsSidebarOpen(next);
    setHasManualSidebarOverride(true);
    if (next) {
      setHoverOverlay(null);
    }
  };

  const handleOrganizationSwitch = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const organizationId = event.target.value;
    if (!organizationId || organizationId === activeOrganizationId) return;

    setIsSwitchingOrganization(true);
    setOrganizationSwitchError(null);
    try {
      const response = await fetch('/api/auth/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        throw new Error(`switch failed: ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      const switchedOrganization = payload.organization as OrganizationSwitchOption | null | undefined;
      setActiveOrganizationId(organizationId);
      setAutoSummary((prev) => prev
        ? { ...prev, organizationName: switchedOrganization?.name ?? prev.organizationName }
        : prev);
      router.push(`/${locale}/home?organization=${encodeURIComponent(organizationId)}`);
      router.refresh();
    } catch (error) {
      setOrganizationSwitchError(t('common.tenantSwitch.error'));
    } finally {
      setIsSwitchingOrganization(false);
    }
  };

  const renderNavigation = (showLabels: boolean) => (
    <nav className="sidebar-nav">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const hasSubmenu = item.submenu && item.submenu.length > 0;
        const isExpanded = showLabels && expandedItems.includes(item.name);

        if (!showLabels) {
          const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => showCollapsedOverlay(event.currentTarget as HTMLElement, item);
          const handleFocus = (event: React.FocusEvent<HTMLElement>) => showCollapsedOverlay(event.currentTarget as HTMLElement, item);

          if (hasSubmenu) {
            const fallbackHref = item.submenu?.[0]?.href ?? item.href;
            return (
              <Link
                key={item.name}
                href={fallbackHref}
                className={`nav-item nav-item-icon-only ${isActive ? 'nav-item-active' : ''}`.trim()}
                onMouseEnter={handleMouseEnter}
                onFocus={handleFocus}
                onBlur={handleCollapsedLeave}
                aria-label={item.name}
                title={item.name}
                aria-haspopup="menu"
                aria-controls="dashboard-sidebar-hover-card"
                aria-current={isActive ? "page" : undefined}
                data-nav-item={item.name}
              >
                {item.icon}
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item nav-item-icon-only ${isActive ? 'nav-item-active' : ''}`.trim()}
              onMouseEnter={handleMouseEnter}
              onFocus={handleFocus}
              onBlur={handleCollapsedLeave}
              aria-label={item.name}
              title={item.name}
              aria-current={isActive ? "page" : undefined}
              data-nav-item={item.name}
            >
              {item.icon}
            </Link>
          );
        }

        if (hasSubmenu) {
          const submenuPanelId = `sidebar-submenu-${item.href.replace(/[^a-zA-Z0-9]+/g, '-')}`;
          return (
            <div key={item.name}>
              <button
                type="button"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedItems(expandedItems.filter(name => name !== item.name));
                  } else {
                    setExpandedItems([...expandedItems, item.name]);
                  }
                }}
                className={`nav-item ${isActive ? 'nav-item-active' : ''} ${showLabels ? 'w-full text-left' : 'nav-item-icon-only'}`.trim()}
                aria-haspopup="true"
                aria-expanded={isExpanded}
                aria-controls={submenuPanelId}
              >
                {item.icon}
                {showLabels && (
                  <>
                    <span className="nav-item-text">{item.name}</span>
                    <svg
                      className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              {showLabels && isExpanded && (
                <div className="submenu" id={submenuPanelId}>
                  {item.submenu?.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        href={subItem.href}
                        className={`submenu-item ${isSubActive ? 'submenu-item-active' : ''}`}
                        aria-current={isSubActive ? "page" : undefined}
                      >
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`nav-item ${isActive ? 'nav-item-active' : ''} ${showLabels ? '' : 'nav-item-icon-only'}`.trim()}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon}
            {showLabels && <span className="nav-item-text">{item.name}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <a href={`#${mainContentId}`} className="skip-link">
        {t('common.skipToContent')}
      </a>
      <div className="dashboard-layout">
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        onMouseLeave={() => {
          if (!isSidebarOpen) {
            handleCollapsedLeave();
          }
        }}
      >
        <div className="sidebar-header">
          {isSidebarOpen && <h2 className="sidebar-logo">{t('common.appName')}</h2>}
          <button
            onClick={toggleSidebar}
            className="sidebar-toggle"
            aria-label="Toggle sidebar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isSidebarOpen ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"}
              />
            </svg>
          </button>
        </div>

        {renderNavigation(isSidebarOpen)}

        {!isSidebarOpen && hoverOverlay && (
          <div
            ref={hoverCardRef}
            className="sidebar-hover-card"
            style={{ top: `${overlayTop}px` }}
            onMouseLeave={handleCollapsedLeave}
            role="menu"
            aria-label={hoverOverlay.item.name}
            id="dashboard-sidebar-hover-card"
            data-testid="sidebar-hover-card"
          >
            <Link href={hoverOverlay.item.href} className="sidebar-hover-main">
              <span className="sidebar-hover-text">{hoverOverlay.item.name}</span>
            </Link>
            {hoverOverlay.item.submenu && hoverOverlay.item.submenu.length > 0 && (
              <div className="sidebar-hover-submenu">
                {hoverOverlay.item.submenu.map((subItem) => (
                  <Link key={subItem.name} href={subItem.href} className="sidebar-hover-submenu-item">
                    {subItem.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-context">
              <nav className="breadcrumb" aria-label="Breadcrumb">
                <ol className="breadcrumb-list">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={crumb.href} className="breadcrumb-item">
                      {index > 0 && (
                        <svg className="breadcrumb-separator" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {crumb.current ? (
                        <span className="breadcrumb-current">{crumb.name}</span>
                      ) : (
                        <Link href={crumb.href} className="breadcrumb-link">
                          {crumb.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            {/* Header Actions */}
            <div className="header-actions">
              {shouldShowOrganizationSwitch && (
                <div className="tenant-switch" data-testid="dashboard-tenant-switch">
                  <label className="tenant-switch-label" htmlFor="dashboard-tenant-switch-select">
                    {t('common.tenantSwitch.label')}
                  </label>
                  <select
                    id="dashboard-tenant-switch-select"
                    className="tenant-switch-select"
                    value={activeOrganizationId ?? ''}
                    onChange={handleOrganizationSwitch}
                    disabled={isSwitchingOrganization}
                    aria-describedby={organizationSwitchError ? 'dashboard-tenant-switch-error' : undefined}
                    data-testid="dashboard-tenant-switch-select"
                  >
                    {availableOrganizations.map((organization) => {
                      const phaseLabel = organization.isms_phase ? phaseLabels[organization.isms_phase] : null;
                      return (
                        <option key={organization.id} value={organization.id}>
                          {phaseLabel ? `${organization.name} (${phaseLabel})` : organization.name}
                        </option>
                      );
                    })}
                  </select>
                  {organizationSwitchError && (
                    <p className="tenant-switch-error" id="dashboard-tenant-switch-error">
                      {organizationSwitchError}
                    </p>
                  )}
                </div>
              )}
              <div className="hidden xl:flex items-center gap-2">
                <a
                  href={PUBLIC_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  {t('common.publicLinks.source')}
                </a>
                <a
                  href={PUBLIC_REPOSITORY_ISSUES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  {t('common.publicLinks.feedback')}
                </a>
              </div>
              <NotificationBell />

              {/* User Menu */}
              <div className="user-menu">
                <button
                  id={userMenuButtonId}
                  ref={userMenuButtonRef}
                  className={`user-menu-button ${isUserMenuOpen ? 'user-menu-button-active' : ''}`.trim()}
                  aria-label={t('common.currentUser')}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-controls={userMenuPanelId}
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  onKeyDown={handleUserMenuButtonKeyDown}
                  data-testid="dashboard-user-menu-button"
                >
                  <div className="user-avatar-small">
                    <span className="user-avatar-initial" aria-hidden>{summaryInitial}</span>
                  </div>
                  <div className="user-menu-text">
                    <span className="user-menu-name">{menuLabel}</span>
                    {secondaryLabel && <span className="user-menu-meta">{secondaryLabel}</span>}
                  </div>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div
                    id={userMenuPanelId}
                    ref={userMenuPanelRef}
                    className="user-menu-panel"
                    role="menu"
                    aria-labelledby={userMenuButtonId}
                    data-testid="dashboard-user-menu-panel"
                    onKeyDown={handleUserMenuKeyDown}
                  >
                    <div className="user-menu-panel-header">
                      <p className="user-menu-panel-name">{menuLabel}</p>
                      {secondaryLabel && (
                        <p className="user-menu-panel-meta">{secondaryLabel}</p>
                      )}
                    </div>
                    <div className="user-menu-list">
                      {userMenuItems.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="user-menu-item"
                          role="menuitem"
                          data-user-menu-item
                          data-testid={`user-menu-item-${item.id}`}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      ))}
                      <a
                        href={PUBLIC_REPOSITORY_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="user-menu-item"
                        role="menuitem"
                        data-user-menu-item
                        data-testid="user-menu-item-public-source"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2v-5m-4-8h6m0 0v6m0-6L10 15" />
                        </svg>
                        <span>{t('common.publicLinks.source')}</span>
                      </a>
                      <a
                        href={PUBLIC_REPOSITORY_ISSUES_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="user-menu-item"
                        role="menuitem"
                        data-user-menu-item
                        data-testid="user-menu-item-public-feedback"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m7-2a8 8 0 11-3.293-6.475L21 4l-1.525 4.293A7.963 7.963 0 0120 12z" />
                        </svg>
                        <span>{t('common.publicLinks.feedback')}</span>
                      </a>
                      <button
                        type="button"
                        className="user-menu-item user-menu-signout"
                        onClick={handleSignOut}
                        data-user-menu-item
                        data-testid="user-menu-item-signout"
                      >
                        <svg className="user-menu-item-icon" aria-hidden fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>{t('common.logout')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id={mainContentId} className="dashboard-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
    </>
  );
};

export default DashboardLayout;
