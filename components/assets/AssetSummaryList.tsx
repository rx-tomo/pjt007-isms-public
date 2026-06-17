import type { RiskAssetWithDetails } from '@/lib/services/informationAsset'

interface AssetSummaryListLabels {
  title: string
  empty: string
  classification: string
  criticality: string
}

interface AssetSummaryListProps {
  assets: RiskAssetWithDetails[]
  labels: AssetSummaryListLabels
  formatAssetType?: (type: string) => string
  formatClassification?: (classification: string) => string
  formatCriticality?: (criticality: string) => string
}

export function AssetSummaryList({
  assets,
  labels,
  formatAssetType = (value) => value,
  formatClassification = (value) => value,
  formatCriticality = (value) => value
}: AssetSummaryListProps) {
  return (
    <div className="border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border bg-surface-elevated">
        <h3 className="text-sm font-semibold text-text-primary">{labels.title}</h3>
      </div>
      {assets.length === 0 ? (
        <div className="px-4 py-6 text-sm text-text-muted">{labels.empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {assets.map((item) => {
            const asset = item.asset
            if (!asset) return null
            return (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{asset.name}</p>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span>
                        {labels.classification}: {formatClassification(asset.classification ?? '')}
                      </span>
                      <span>
                        {labels.criticality}: {formatCriticality(asset.criticality ?? '')}
                      </span>
                      {asset.location && <span>{asset.location}</span>}
                    </div>
                    {asset.description && (
                      <p className="mt-1 text-xs text-text-muted">{asset.description}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 h-fit">
                    {formatAssetType(asset.asset_type ?? '')}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
