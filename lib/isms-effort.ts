/** Assumed hands-on minutes per item, including time spent recording the work. */
export const effortScenarios = {
  evidence: [
    { step: 'judge', count: 24, before: 5, after: 5 },
    { step: 'log', count: 6, before: 2, after: 3 },
    { step: 'chase', count: 6, before: 6, after: 6 },
    { step: 'locate', count: 6, before: 5, after: 1 },
  ],
  risks: [
    { step: 'issue', count: 10, before: 1, after: 2 },
    { step: 'assess', count: 30, before: 12, after: 12 },
    { step: 'remind', count: 3, before: 5, after: 5 },
    { step: 'merge', count: 10, before: 5, after: 2 },
    { step: 'accept', count: 30, before: 3, after: 3 },
  ],
  tasks: [
    { step: 'update', count: 12, before: 2, after: 2 },
    { step: 'locate', count: 12, before: 4, after: 1 },
    { step: 'contact', count: 3, before: 6, after: 6 },
  ],
  approvals: [
    { step: 'review', count: 6, before: 20, after: 20 },
    { step: 'record', count: 6, before: 5, after: 1 },
  ],
} as const;

export type EffortScenario = keyof typeof effortScenarios;
export const scenarioOrder = ['evidence', 'risks', 'tasks', 'approvals'] as const;
export const defaultCycles = {
  evidence: 1, risks: 1, tasks: 48, approvals: 12,
} satisfies Record<EffortScenario, number>;

export function totalsFor(scenario: EffortScenario) {
  return effortScenarios[scenario].reduce(
    (sum, row) => ({
      before: sum.before + row.count * row.before,
      after: sum.after + row.count * row.after,
    }),
    { before: 0, after: 0 },
  );
}
