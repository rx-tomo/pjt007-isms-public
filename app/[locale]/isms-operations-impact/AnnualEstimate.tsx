'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { defaultCycles, scenarioOrder, totalsFor, type EffortScenario } from '@/lib/isms-effort';

const frequencies = [0, 1, 2, 4, 6, 12, 24, 48, 52];

export default function AnnualEstimate() {
  const t = useTranslations('publicSeo.impact');
  const [cycles, setCycles] = useState<Record<EffortScenario, number>>(defaultCycles);
  const rows = scenarioOrder.map((key) => ({ key, times: cycles[key], ...totalsFor(key) }));
  const before = rows.reduce((sum, row) => sum + row.times * row.before, 0);
  const after = rows.reduce((sum, row) => sum + row.times * row.after, 0);
  const duration = (minutes: number) => t('duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });

  return (
    <section aria-labelledby="annual-heading" className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <h2 id="annual-heading" className="text-lg font-semibold">{t('annualWorksheet')}</h2>
      <p className="mt-1 text-sm text-text-secondary">{t('annualLabel')}</p>
      <div aria-live="polite" aria-atomic="true" className="mt-3">
        <p className="text-lg font-semibold tabular-nums">{t('estimatedDifference', { time: duration(before - after) })}</p>
        <p className="mt-2 text-sm text-text-secondary">{t('annualComparison', { before: duration(before), after: duration(after) })}</p>
      </div>
      <p className="my-4 text-sm text-text-secondary">{t('adjust')}</p>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-border">
          {(['workflow', 'frequency', 'annualDelta'] as const).map((field) => (
            <th key={field} scope="col" className="pb-2 pr-2 font-medium">{t(field)}</th>
          ))}
        </tr></thead>
        <tbody>{rows.map(({ key, before: current, after: withTool, times }) => (
          <tr key={key} className="border-b border-border">
            <th scope="row" className="py-2 pr-2 font-normal">
              <a href={`#${key}`} className="text-accent underline underline-offset-2">{t(`${key}.short`)}</a>
              <span className="block text-xs text-text-secondary">{t('cycleDelta', { minutes: current - withTool })}</span>
            </th>
            <td className="py-2 pr-2">
              <select aria-label={t('setFrequency', { name: t(`${key}.short`) })} value={times}
                onChange={(event) => setCycles({ ...cycles, [key]: Number(event.target.value) })}
                className="rounded border border-border bg-surface p-1.5 text-text-primary">
                {frequencies.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </td>
            <td className="py-2 tabular-nums">{duration((current - withTool) * times)}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
