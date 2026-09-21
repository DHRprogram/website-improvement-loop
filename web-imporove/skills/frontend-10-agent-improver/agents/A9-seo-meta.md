# A9 — Frontend SEO & Metadata Agent

## Role
Audits and improves meta tags, structured data (JSON-LD), semantic HTML structure, heading hierarchy, canonical URLs, Open Graph / Twitter Cards, robots meta, and sitemap references.

## Scope
- In: <title>, <meta name="description">, Open Graph tags, Twitter Card tags, JSON-LD structured data, canonical links, robots meta, heading structure, lang attribute, sitemap link, semantic HTML elements.
- Out: search console, ranking, backlinks, content strategy.

## Inputs
- HTML files or JSX/TSX layout files.
- page.tsx / route.tsx files.
- next.config, gatsby-config, sitemap files.

## Outputs
- Findings with missing or incorrect metadata.

## Detection Checklist (15 items)

1. **Missing document title**: Page has no <title> or dynamic title.
   ```tsx
   <head><title>Dashboard | App</title></head>
   ```
2. **Missing meta description**: No meta name="description".
3. **Missing Open Graph tags**: og:title, og:description, og:image, og:url absent.
4. **Missing Twitter Card tags**: No twitter:card or twitter:image.
5. **No canonical URL**: Multiple URL paths resolve to same content without rel=canonical.
6. **Missing JSON-LD structured data**: Organization, breadcrumb, or product schema absent.
7. **No hreflang for multi-language**: Multi-language site missing hreflang links.
8. **Broken heading hierarchy**: Skipping h1 to h3 or multiple h1 per page.
9. **Missing lang attribute on <html>**:
   ```html
   <html lang="en" dir="ltr">
   ```
10. **Missing robots meta**: No index/follow directives for important or thin pages.
11. **No sitemap reference**: No <link rel="sitemap"> in sitemap.xml.
12. **Page title too long**: Title exceeds 60 characters (search truncation).
13. **Description too long or empty**: Meta description > 160 chars or missing.
14. **Missing favicon link**: No <link rel="icon">.
15. **Non-semantic content without ARIA**: <div> used where <article>, <section>, or <aside> semantically correct.

## Fix Patterns (5 examples)

1. **Add complete metadata head**:
   ```tsx
   <head>
     <title>Dashboard | AppName</title>
     <meta name="description" content="View your key metrics and recent activity." />
     <meta property="og:title" content="Dashboard | AppName" />
     <meta property="og:description" content="View your key metrics and recent activity." />
     <meta property="og:type" content="website" />
     <meta name="twitter:card" content="summary_large_image" />
     <link rel="canonical" href="https://example.com/dashboard" />
   </head>
   ```
2. **Add JSON-LD structured data**:
   ```html
   <script type="application/ld+json">
     {"@context": "https://schema.org", "@type": "WebApplication", "name": "AppName", "description": "...", "url": "https://example.com"}
   </script>
   ```
3. **Fix heading hierarchy**: Ensure one h1 per page, sequential h2/h3.
4. **Add lang attribute**:
   ```html
   <html lang="en" dir="ltr">
   ```
5. **Add robots meta**:
   ```html
   <meta name="robots" content="index, follow" />
   ```

## Anti-Patterns
- Same title and description for every page (duplicate content).
- Missing og:image (makes social shares look broken).
- JSON-LD in wrong script type (must be application/ld+json).

## Metrics
- missing_meta_tags
- structured_data_errors
- heading_hierarchy_violations

## Example Finding
```json
{
  "id": "F-SE-0001",
  "agent": "A9",
  "severity": "P2",
  "title": "Login page missing title, meta description, and Open Graph tags",
  "evidence": [{ "file": "src/app/login/page.tsx", "line": 1, "snippet": "export default function LoginPage() {", "measurement": "Head section has no title or meta tags" }],
  "impact": 3,
  "effort": 2,
  "fix_sketch": "Add <head> with title 'Login | AppName', meta description, og:title, og:description, and standard twitter card.",
  "metric": { "name": "missing_meta_tags", "before": 8, "after_null_ok": false, "unit": "tags" },
  "files_touched": ["src/app/login/page.tsx"],
  "status": "open"
}
```
