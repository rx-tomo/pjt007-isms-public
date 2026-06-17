import type { UserRole } from '@/lib/services/user'

export type RoleKey = UserRole
export type StatCardId = 'users' | 'documents' | 'risks' | 'tasks' | 'audits'

interface QuickLinkDefinition {
  path: string;
  badge: string;
  badgeTone: string;
  titleToken: string;
  descriptionToken: string;
}

export interface RoleHomeConfig {
  defaultRoute: string;
  quickLinks: QuickLinkDefinition[];
}

const ROLE_HOME_CONFIG: Record<RoleKey, RoleHomeConfig> = {
  super_admin: {
    defaultRoute: '/super-admin/organizations',
    quickLinks: [
      {
        path: '/super-admin/organizations',
        badge: 'Tenants',
        badgeTone: 'bg-slate-100 text-slate-700',
        titleToken: 'quickLinks.items.superAdmin.organizations.title',
        descriptionToken: 'quickLinks.items.superAdmin.organizations.description'
      },
      {
        path: '/super-admin/logs',
        badge: 'Audit',
        badgeTone: 'bg-slate-100 text-slate-700',
        titleToken: 'quickLinks.items.superAdmin.audit.title',
        descriptionToken: 'quickLinks.items.superAdmin.audit.description'
      }
    ]
  },
  system_operator: {
    defaultRoute: '/home',
    quickLinks: [
      {
        path: '/settings/organization',
        badge: 'Settings',
        badgeTone: 'bg-purple-100 text-purple-700',
        titleToken: 'quickLinks.items.systemOperator.settings.title',
        descriptionToken: 'quickLinks.items.systemOperator.settings.description'
      },
      {
        path: '/settings/controls',
        badge: 'RLS',
        badgeTone: 'bg-purple-100 text-purple-700',
        titleToken: 'quickLinks.items.systemOperator.policies.title',
        descriptionToken: 'quickLinks.items.systemOperator.policies.description'
      }
    ]
  },
  org_admin: {
    defaultRoute: '/home',
    quickLinks: [
      {
        path: '/settings/users',
        badge: 'Team',
        badgeTone: 'bg-blue-100 text-blue-700',
        titleToken: 'quickLinks.items.orgAdmin.members.title',
        descriptionToken: 'quickLinks.items.orgAdmin.members.description'
      },
      {
        path: '/settings/subscription',
        badge: 'Billing',
        badgeTone: 'bg-blue-100 text-blue-700',
        titleToken: 'quickLinks.items.orgAdmin.billing.title',
        descriptionToken: 'quickLinks.items.orgAdmin.billing.description'
      },
      {
        path: '/documents',
        badge: 'Docs',
        badgeTone: 'bg-blue-100 text-blue-700',
        titleToken: 'quickLinks.items.orgAdmin.documents.title',
        descriptionToken: 'quickLinks.items.orgAdmin.documents.description'
      }
    ]
  },
  user: {
    defaultRoute: '/home',
    quickLinks: [
      {
        path: '/tasks',
        badge: 'Tasks',
        badgeTone: 'bg-emerald-100 text-emerald-700',
        titleToken: 'quickLinks.items.member.tasks.title',
        descriptionToken: 'quickLinks.items.member.tasks.description'
      },
      {
        path: '/documents',
        badge: 'Docs',
        badgeTone: 'bg-emerald-100 text-emerald-700',
        titleToken: 'quickLinks.items.member.documents.title',
        descriptionToken: 'quickLinks.items.member.documents.description'
      },
      {
        path: '/education',
        badge: 'Training',
        badgeTone: 'bg-emerald-100 text-emerald-700',
        titleToken: 'quickLinks.items.member.training.title',
        descriptionToken: 'quickLinks.items.member.training.description'
      }
    ]
  },
  auditor: {
    defaultRoute: '/home',
    quickLinks: [
      {
        path: '/audit',
        badge: 'Audit',
        badgeTone: 'bg-amber-100 text-amber-700',
        titleToken: 'quickLinks.items.auditor.workspace.title',
        descriptionToken: 'quickLinks.items.auditor.workspace.description'
      },
      {
        path: '/audit/nonconformities',
        badge: 'Follow-up',
        badgeTone: 'bg-amber-100 text-amber-700',
        titleToken: 'quickLinks.items.auditor.correctiveActions.title',
        descriptionToken: 'quickLinks.items.auditor.correctiveActions.description'
      }
    ]
  },
  approver: {
    defaultRoute: '/home',
    quickLinks: [
      {
        path: '/approvals?status=pending',
        badge: 'Approve',
        badgeTone: 'bg-rose-100 text-rose-700',
        titleToken: 'quickLinks.items.approver.pendingDocuments.title',
        descriptionToken: 'quickLinks.items.approver.pendingDocuments.description'
      },
      {
        path: '/approvals?status=pending&urgency=due',
        badge: 'Due',
        badgeTone: 'bg-rose-100 text-rose-700',
        titleToken: 'quickLinks.items.approver.reviewTasks.title',
        descriptionToken: 'quickLinks.items.approver.reviewTasks.description'
      }
    ]
  }
};

const DEFAULT_STAT_CARD_PATHS: Record<StatCardId, string> = {
  users: '/settings/users',
  documents: '/documents',
  risks: '/risks',
  tasks: '/tasks',
  audits: '/audit'
};

const ROLE_STAT_CARD_OVERRIDES: Partial<Record<RoleKey, Partial<Record<StatCardId, string>>>> = {
  auditor: {
    documents: '/documents?status=in_review',
    tasks: '/audit/nonconformities'
  },
  approver: {
    documents: '/approvals?status=pending',
    tasks: '/approvals?status=pending&urgency=due'
  }
};

const STAT_CARD_ROLE_REQUIREMENTS: Partial<Record<StatCardId, RoleKey[]>> = {
  users: ['super_admin', 'system_operator', 'org_admin'],
  audits: ['super_admin', 'system_operator', 'org_admin', 'auditor']
};

export type TranslateFn = (key: string, values?: Record<string, any>) => string;

export interface QuickLink {
  title: string;
  description: string;
  href: string;
  badge: string;
  badgeTone: string;
}

function resolvePath(locale: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function getRoleDefaultRoute(role: RoleKey): string {
  const config = ROLE_HOME_CONFIG[role];
  return config?.defaultRoute ?? '/home';
}

export function getHomeQuickLinks(role: RoleKey, locale: string, t: TranslateFn): QuickLink[] {
  const config = ROLE_HOME_CONFIG[role] ?? ROLE_HOME_CONFIG.user;
  return config.quickLinks.map((link) => ({
    title: t(link.titleToken),
    description: t(link.descriptionToken),
    href: resolvePath(locale, link.path),
    badge: link.badge,
    badgeTone: link.badgeTone
  }));
}

export function getStatCardHref(cardId: StatCardId, role: RoleKey, locale: string): string {
  const overrides = ROLE_STAT_CARD_OVERRIDES[role] ?? {};
  const target = overrides[cardId] ?? DEFAULT_STAT_CARD_PATHS[cardId] ?? '/home';
  return resolvePath(locale, target);
}

export function hasStatCardAccess(cardId: StatCardId, role: RoleKey): boolean {
  const requiredRoles = STAT_CARD_ROLE_REQUIREMENTS[cardId];
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.includes(role);
}

export function getRoleHomeSummary() {
  return ROLE_HOME_CONFIG;
}
