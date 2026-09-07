#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { pathToRegexp } = require('next/dist/compiled/path-to-regexp')

const repoRoot = path.resolve(__dirname, '..')
const metadataPath = path.join(repoRoot, 'app/[locale]/metadata.ts')
const metadataSource = fs.readFileSync(metadataPath, 'utf8')
const middlewarePath = path.join(repoRoot, 'middleware.ts')
const middlewareSource = fs.readFileSync(middlewarePath, 'utf8')
const sitemapPath = path.join(repoRoot, 'app/sitemap.ts')
const robotsPath = path.join(repoRoot, 'app/robots.ts')
const sitemapSource = fs.readFileSync(sitemapPath, 'utf8')
const robotsSource = fs.readFileSync(robotsPath, 'utf8')
const authLayoutPath = path.join(repoRoot, 'app/[locale]/auth/layout.tsx')
const devLoginLayoutPath = path.join(repoRoot, 'app/[locale]/dev-login/layout.tsx')
const pricingLayoutPath = path.join(repoRoot, 'app/[locale]/pricing/layout.tsx')

const requiredSnippets = [
  "const DEFAULT_SITE_URL = 'https://riscala-ai.com'",
  'metadataBase: new URL(siteUrl)',
  'url: canonicalUrl',
  'canonical: canonicalPath',
]

const forbiddenSnippets = [
  'riscala-isms.com',
]

const publicMetadataPaths = ['/sitemap.xml', '/robots.txt']
const localeFixture = '/ja'
const intendedPublicSitemapExclusions = ['/auth', '/dev-login', '/pricing', '/home']

const findings = []

function findMatchingBracket(source, openingIndex) {
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index]
    const nextCharacter = source[index + 1]

    if (lineComment) {
      if (character === '\n') {
        lineComment = false
      }
      continue
    }

    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '/' && nextCharacter === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
    } else if (character === '[') {
      depth += 1
    } else if (character === ']') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function extractMiddlewareMatchers(source) {
  const configStart = source.indexOf('export const config')
  if (configStart === -1) {
    throw new Error('export const config was not found')
  }

  const matcherDeclaration = /\bmatcher\s*:\s*/.exec(source.slice(configStart))
  if (!matcherDeclaration) {
    throw new Error('config.matcher was not found')
  }

  const matcherValueStart =
    configStart + matcherDeclaration.index + matcherDeclaration[0].length
  const arrayStart = source.indexOf('[', matcherValueStart)
  if (arrayStart === -1) {
    throw new Error('config.matcher is not an array literal')
  }

  const arrayEnd = findMatchingBracket(source, arrayStart)
  if (arrayEnd === -1) {
    throw new Error('config.matcher array is not closed')
  }

  const arrayExpression = source.slice(arrayStart, arrayEnd + 1)
  const matchers = vm.runInNewContext(`(${arrayExpression})`, Object.create(null), {
    timeout: 1000,
  })

  if (
    !Array.isArray(matchers) ||
    matchers.length === 0 ||
    matchers.some((matcher) => typeof matcher !== 'string' || matcher.length === 0)
  ) {
    throw new Error('config.matcher must evaluate to a non-empty string array')
  }

  return matchers
}

function compileMiddlewareMatchers(matchers) {
  return matchers.map((matcher, index) => ({
    index,
    matcher,
    regexp: pathToRegexp(matcher, [], { delimiter: '/' }),
  }))
}

for (const snippet of requiredSnippets) {
  if (!metadataSource.includes(snippet)) {
    findings.push(`missing required metadata snippet: ${snippet}`)
  }
}

for (const snippet of forbiddenSnippets) {
  if (metadataSource.includes(snippet)) {
    findings.push(`found stale metadata snippet: ${snippet}`)
  }
}

try {
  const middlewareMatchers = extractMiddlewareMatchers(middlewareSource)
  const compiledMiddlewareMatchers = compileMiddlewareMatchers(middlewareMatchers)

  for (const metadataPath of publicMetadataPaths) {
    const matchingMatchers = compiledMiddlewareMatchers.filter(({ regexp }) =>
      regexp.test(metadataPath),
    )
    if (matchingMatchers.length > 0) {
      findings.push(
        `metadata route is intercepted by middleware matcher(s) ${matchingMatchers
          .map(({ index }) => index + 1)
          .join(', ')}: ${metadataPath}`,
      )
    }
  }

  const localeMatchers = compiledMiddlewareMatchers.filter(({ regexp }) =>
    regexp.test(localeFixture),
  )
  if (localeMatchers.length === 0) {
    findings.push(`middleware matcher contract no longer covers locale route: ${localeFixture}`)
  }
} catch (error) {
  findings.push(`unable to evaluate middleware config.matcher: ${error.message}`)
}

for (const snippet of [
  "const DEFAULT_SITE_URL = 'https://riscala-ai.com'",
  'new URL(configuredUrl).origin',
  'return PUBLIC_LOCALES.map((locale) => ({',
  'url: `${siteUrl}/${locale}`',
]) {
  if (!sitemapSource.includes(snippet)) {
    findings.push(`missing sitemap URL contract: ${snippet}`)
  }
}

for (const snippet of [
  "const DEFAULT_SITE_URL = 'https://riscala-ai.com'",
  'new URL(configuredUrl).origin',
  'sitemap: `${siteUrl}/sitemap.xml`',
]) {
  if (!robotsSource.includes(snippet)) {
    findings.push(`missing robots URL contract: ${snippet}`)
  }
}

for (const excludedPath of intendedPublicSitemapExclusions) {
  if (sitemapSource.includes(excludedPath)) {
    findings.push(`sitemap contains non-registry public path: ${excludedPath}`)
  }
}

for (const [label, filePath, snippet] of [
  ['sitemap', sitemapPath, "const PUBLIC_LOCALES = ['ja', 'en', 'zh'] as const;"],
  ['robots', robotsPath, "sitemap: `${siteUrl}/sitemap.xml`,"],
  ['auth noindex', authLayoutPath, 'index: false,'],
  ['dev-login noindex', devLoginLayoutPath, 'index: false,'],
  ['pricing noindex', pricingLayoutPath, 'index: false,'],
]) {
  if (!fs.existsSync(filePath) || !fs.readFileSync(filePath, 'utf8').includes(snippet)) {
    findings.push(`missing required ${label} SEO configuration`)
  }
}

if (findings.length > 0) {
  console.error('Public metadata QA failed.')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Public metadata QA passed. Canonical metadata, sitemap, robots, and noindex boundaries are configured.')
