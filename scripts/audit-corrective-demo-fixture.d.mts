import type { Transaction } from '@libsql/client';
export const auditDemoOrganizationId: string;
export const auditDemoPlanId: string;
export const auditDemoNcId: string;
export function buildAuditCorrectiveDemo(anchor?: Date): Record<string, Record<string, string | null>[]>;
export function insertAuditCorrectiveDemo(transaction: Pick<Transaction, 'execute'>, anchor?: Date): Promise<{ inserted: number; planId: string; nonconformityId: string }>;
