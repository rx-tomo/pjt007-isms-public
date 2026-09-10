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
  'url: `${siteUrl}/${locale}${pathname}`',
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

const landingCtaPath = path.join(repoRoot, 'components/CTASection.tsx')
const publicLinksPath = path.join(repoRoot, 'lib/publicLinks.ts')
const researchPagePath = path.join(repoRoot, 'app/[locale]/research/page.tsx')
const researchClientPath = path.join(repoRoot, 'app/[locale]/research/ResearchAssessment.tsx')
const researchIssueFormPath = path.join(repoRoot, '.github/ISSUE_TEMPLATE/research-interview.yml')

function readRequired(filePath, label) {
  if (!fs.existsSync(filePath)) {
    findings.push(`missing required research funnel file: ${label}`)
    return ''
  }
  return fs.readFileSync(filePath, 'utf8')
}

const landingCtaSource = readRequired(landingCtaPath, 'components/CTASection.tsx')
const publicLinksSource = readRequired(publicLinksPath, 'lib/publicLinks.ts')
const researchPageSource = readRequired(researchPagePath, 'app/[locale]/research/page.tsx')
const researchClientSource = readRequired(
  researchClientPath,
  'app/[locale]/research/ResearchAssessment.tsx',
)
const researchIssueFormSource = readRequired(
  researchIssueFormPath,
  '.github/ISSUE_TEMPLATE/research-interview.yml',
)

if (
  !middlewareSource.includes('PUBLIC_PAGE_PATH') ||
  !middlewareSource.includes('research\\/?')
) {
  findings.push('public route regex does not allow localized /research')
}

for (const locale of ['ja', 'en', 'zh']) {
  if (!sitemapSource.includes(`'${locale}'`)) {
    findings.push(`sitemap is missing locale: ${locale}`)
  }
}
if (
  !sitemapSource.includes("const PUBLIC_PATHS = ['', '/research', '/guide'] as const;") ||
  !sitemapSource.includes('PUBLIC_PATHS.flatMap')
) {
  findings.push('sitemap does not generate the localized /research and /guide routes from PUBLIC_PATHS')
}
if (
  !sitemapSource.includes('GUIDE_ARTICLES.flatMap') ||
  !sitemapSource.includes('lastModified: article.updatedAt')
) {
  findings.push('sitemap does not generate localized guide article routes with lastModified')
}

// SEO ガイド: 公開許可・canonical/x-default・JSON-LD・計測タグの本番限定
const guideHubPath = path.join(repoRoot, 'app/[locale]/guide/page.tsx')
const guideArticlePath = path.join(repoRoot, 'app/[locale]/guide/[slug]/page.tsx')
const guideSitePath = path.join(repoRoot, 'lib/guides/site.ts')
const localeLayoutPath = path.join(repoRoot, 'app/[locale]/layout.tsx')
const guideHubSource = readRequired(guideHubPath, 'app/[locale]/guide/page.tsx')
const guideArticleSource = readRequired(guideArticlePath, 'app/[locale]/guide/[slug]/page.tsx')
const guideSiteSource = readRequired(guideSitePath, 'lib/guides/site.ts')
const localeLayoutSource = readRequired(localeLayoutPath, 'app/[locale]/layout.tsx')

if (!middlewareSource.includes('guide(\\/[a-z0-9-]+)?\\/?')) {
  findings.push('public route regex does not allow localized /guide and /guide/[slug]')
}
if (!guideSiteSource.includes("languages['x-default']")) {
  findings.push('language alternates helper does not emit hreflang x-default')
}
for (const [label, source] of [
  ['landing metadata', metadataSource],
  ['research page', researchPageSource],
  ['guide hub', guideHubSource],
  ['guide article', guideArticleSource],
]) {
  if (!source.includes('buildLanguageAlternates(')) {
    findings.push(`${label} does not use the shared hreflang/x-default helper`)
  }
}
for (const [label, source] of [
  ['guide hub', guideHubSource],
  ['guide article', guideArticleSource],
]) {
  if (!source.includes('canonical: canonicalPath')) {
    findings.push(`${label} is missing a canonical URL`)
  }
}
if (!guideArticleSource.includes('generateStaticParams') || !guideArticleSource.includes('dynamicParams = false')) {
  findings.push('guide article route is not statically generated for known slugs only')
}
if (!localeLayoutSource.includes("process.env.VERCEL_ENV === 'production'")) {
  findings.push('analytics tags are not gated to the production deployment')
}

if (!landingCtaSource.includes("href={`/${locale}/research`}")) {
  findings.push('landing CTA is missing the localized research link')
}

if (
  !publicLinksSource.includes('PUBLIC_RESEARCH_INTERVIEW_URL') ||
  !publicLinksSource.includes('issues/new?template=research-interview.yml')
) {
  findings.push('dedicated research interview Issue Form URL is missing')
}

if (!researchPageSource.includes('ResearchAssessment')) {
  findings.push('research page does not render the assessment component')
}

const issueFormTypes = [...researchIssueFormSource.matchAll(/^\s*- type:\s*([a-z-]+)/gm)].map(
  (match) => match[1],
)
const allowedIssueFormTypes = new Set(['markdown', 'dropdown', 'radio', 'checkboxes'])
if (issueFormTypes.length === 0) {
  findings.push('research Issue Form has no body fields')
}
for (const type of issueFormTypes) {
  if (!allowedIssueFormTypes.has(type)) {
    findings.push(`research Issue Form uses a non-fixed-choice field type: ${type}`)
  }
}
if (/^\s*- type:\s*(input|textarea|text)\b/im.test(researchIssueFormSource)) {
  findings.push('research Issue Form contains a free-text field')
}
const issueFormBody = researchIssueFormSource.slice(researchIssueFormSource.indexOf('body:'))
if (/(?:^|\n)\s*(?:id|label):[^\n]*(?:name|organization|email|phone|username)/im.test(issueFormBody)) {
  findings.push('research Issue Form requests identity or contact fields')
}
if (
  !/id:\s*public_data_acknowledgement[\s\S]{0,500}required:\s*true/i.test(issueFormBody) ||
  !/public[\s\S]{0,220}github[\s\S]{0,220}account/i.test(issueFormBody)
) {
  findings.push('research Issue Form is missing a required public GitHub identity acknowledgment')
}

const requiredAnalyticsPushes = [
  "window.dataLayer.push({ event: 'assessment_start' });",
  "window.dataLayer.push({ event: 'assessment_complete', result_band: resultBand });",
  "window.dataLayer.push({ event: 'interview_interest_click' });",
]
for (const snippet of requiredAnalyticsPushes) {
  if (!researchClientSource.includes(snippet)) {
    findings.push(`missing privacy-safe analytics payload: ${snippet}`)
  }
}
const analyticsPushes = [...researchClientSource.matchAll(/window\.dataLayer\.push\(\{([^}]*)\}\);/g)]
if (analyticsPushes.length !== 3) {
  findings.push(`expected exactly 3 local dataLayer pushes, found ${analyticsPushes.length}`)
}
for (const [, payload] of analyticsPushes) {
  const keys = [...payload.matchAll(/\b([a-z_]+)\s*:/g)].map((match) => match[1])
  if (keys.some((key) => !['event', 'result_band'].includes(key))) {
    findings.push(`analytics payload has an unexpected key: ${keys.join(', ')}`)
  }
  if (/(answer|question|free.?text|organization|username|email|phone|name|score|locale)/i.test(payload)) {
    findings.push('analytics payload contains answer, question, score, locale, or identity data')
  }
}
if (/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|FormData)\b|document\.cookie/.test(researchClientSource)) {
  findings.push('research assessment includes a persistence or network submission API')
}

if (findings.length > 0) {
  console.error('Public metadata QA failed.')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Public metadata QA passed. Canonical metadata, sitemap, robots, and noindex boundaries are configured.')
