'use client'

import { useMemo, useState } from 'react'
import type { InformationAsset } from '@/lib/services/informationAsset'

interface AssetSelectorLabels {
  title: string
  searchPlaceholder: string
  empty: string
  selectedCount: (count: number) => string
  classification: string
  criticality: string
  owner?: string
  department?: string
}

interface AssetSelectorProps {
  assets: InformationAsset[]
  selectedAssetIds: string[]
  onChange: (assetIds: string[]) => void
  labels: AssetSelectorLabels
  formatAssetType?: (type: InformationAsset['asset_type']) => string
  formatClassification?: (classification: InformationAsset['classification']) => string
  formatCriticality?: (criticality: InformationAsset['criticality']) => string
}

export function AssetSelector({
  assets,
  selectedAssetIds,
  onChange,
  labels,
  formatAssetType = (value) => value ?? '',
  formatClassification = (value) => value ?? '',
  formatCriticality = (value) => value ?? ''
}: AssetSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredAssets = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    if (!keyword) {
      return assets
    }

    return assets.filter((asset) => {
      return [
        asset.name,
        asset.asset_type,
        asset.classification,
        asset.criticality,
        asset.location || ''
      ]
        .filter((v): v is string => Boolean(v))
        .some((value) => value.toLowerCase().includes(keyword))
    })
  }, [assets, searchTerm])

  const toggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      onChange(selectedAssetIds.filter((id) => id !== assetId))
    } else {
      onChange([...selectedAssetIds, assetId])
    }
  }

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{labels.title}</h3>
          <p className="text-xs text-text-muted">{labels.selectedCount(selectedAssetIds.length)}</p>
        </div>
        <div className="w-48">
          <label className="sr-only" htmlFor="asset-search">
            {labels.searchPlaceholder}
          </label>
          <input
            id="asset-search"
            type="search"
            className="w-full px-2 py-1 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={labels.searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto divide-y divide-border">
        {filteredAssets.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            {labels.empty}
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const assetWithMeta = asset as InformationAsset & {
              owner_name?: string | null
              owner_department?: string | null
              owner_email?: string | null
            }
            const isChecked = selectedAssetIds.includes(asset.id)
            return (
              <label
                key={asset.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isChecked ? 'bg-indigo-50' : 'hover:bg-surface-elevated'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                  checked={isChecked}
                  onChange={() => toggleAsset(asset.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-text-primary">{asset.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {formatAssetType(asset.asset_type)}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
                    <span>
                      {labels.classification}: {formatClassification(asset.classification)}
                    </span>
                    <span>
                      {labels.criticality}: {formatCriticality(asset.criticality)}
                    </span>
                    {asset.location && <span>{asset.location}</span>}
                    {labels.owner && assetWithMeta.owner_name && (
                      <span>
                        {labels.owner}: {assetWithMeta.owner_name}
                      </span>
                    )}
                    {labels.department && assetWithMeta.owner_department && (
                      <span>
                        {labels.department}: {assetWithMeta.owner_department}
                      </span>
                    )}
                  </div>
                  {asset.description && (
                    <p className="mt-1 text-xs text-text-muted line-clamp-2">{asset.description}</p>
                  )}
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
