#!/usr/bin/env node
void import('./lib/run-isolated-practical-e2e.mjs')
  .then(({ runIsolatedPracticalE2E }) => (
    runIsolatedPracticalE2E('surveillanceResidualAcceptance', process.argv.slice(2))
  ))
  .then(({ status }) => {
    process.exitCode = status
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
