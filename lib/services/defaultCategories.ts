import { riskCategories, taskCategories } from '@/lib/db/drizzle/schema'

/**
 * Create default risk and task categories for a new organization.
 * Accepts either a Drizzle DB instance or a transaction handle.
 */
export async function createDefaultCategories(db: any, organizationId: string) {
  // Default risk categories
  const riskCats = [
    { name: '情報セキュリティ', nameEn: 'Information Security', color: '#EF4444' },
    { name: '事業継続', nameEn: 'Business Continuity', color: '#F59E0B' },
    { name: 'コンプライアンス', nameEn: 'Compliance', color: '#10B981' },
    { name: '人的リスク', nameEn: 'Human Risk', color: '#3B82F6' },
    { name: '技術的リスク', nameEn: 'Technical Risk', color: '#8B5CF6' }
  ]

  try {
    await db.insert(riskCategories).values(
      riskCats.map((cat, index) => ({
        id: crypto.randomUUID(),
        organizationId,
        name: cat.name,
        description: cat.nameEn,
        color: cat.color,
        displayOrder: index + 1,
      }))
    )
  } catch (err) {
    console.error('Failed to create risk categories', err)
  }

  // Default task categories
  const taskCats = [
    { name: 'ISMS構築' },
    { name: '文書作成' },
    { name: 'リスク対応' },
    { name: '内部監査' },
    { name: '是正措置' }
  ]

  try {
    await db.insert(taskCategories).values(
      taskCats.map((cat, index) => ({
        id: crypto.randomUUID(),
        organizationId,
        name: cat.name,
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
        displayOrder: index + 1,
      }))
    )
  } catch (err) {
    console.error('Failed to create task categories', err)
  }
}
