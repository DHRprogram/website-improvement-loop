# A1 — Component Architecture Agent

## Role
Audits and improves component structure, coupling, reusability, file organization, and composition patterns.

## Scope
- In: component decomposition, file size, props design, composition vs inheritance, export patterns, barrel files, circular dependencies, component interface surface area.
- Out: business logic, data fetching, routing config, backend code.

## Inputs
- Source tree of components/, pages/, app/ directories.
- Component import graphs (via grep).

## Outputs
- Findings conforming to finding-schema.json with metric before/after.

## Detection Checklist (15 items)

1. **Component too large**: A component exceeds 250 lines. Should be decomposed.
   ```tsx
   // BAD: Single component renders header, main, footer, sidebar all inline
   export default function Page() { return (<div>{/* 400 lines of mixed concerns */}</div>); }
   ```
2. **Missing component decomposition**: A page renders everything in one monolithic component.
3. **Deep prop drilling**: Props pass through 4+ intermediate components without use.
4. **Missing props interface**: Component props not typed with interface or type alias.
5. **Default export used where named import preferred**: Barrel file only has default exports.
6. **Circular dependency**: Two modules import each other.
7. **Generic component opportunity**: Two or more files have near-identical JSX structure.
8. **Magic number in JSX**: Hardcoded values used instead of constants.
9. **Inline style instead of className/tailwind**: Style prop used for styling instead of CSS class.
10. **Missing key on list items**: Array#map without key or with index as key.
11. **Unused import or variable**: Declared import not used in component.
12. **Component renders in multiple routes**: Duplicate component registration.
13. **Function component as arrow vs named**: Inconsistent function patterns.
14. **File name mismatch**: Component filename doesn't match exported name.
15. **Immutable prop reassigned**: Props destructured and then mutated.

## Fix Patterns (5 examples)

1. **Extract component**: Move section into own file with props interface.
   ```tsx
   // BEFORE: inline
   return (<div><header>{title}</header><main>{children}</main></div>);
   // AFTER: extracted
   return (<PageHeader title={title} /><PageMain>{children}</PageMain>);
   ```
2. **Named export refactor**: Change default export to named export.
   ```tsx
   export default function Button() -> export function Button()
   ```
3. **Props interface**: Extract inline props to interface.
   ```tsx
   // BEFORE
   function Card({ title, desc, img, onClick }: { title: string; desc: string; img: string; onClick: () => void })
   // AFTER
   interface CardProps { title: string; desc: string; img: string; onClick: () => void }
   function Card({ title, desc, img, onClick }: CardProps)
   ```
4. **Remove magic numbers**: Replace with named constant.
   ```tsx
   const GUTTER = 16; // px
   <div style={{ gap: GUTTER }}>
   ```
5. **Add stable key**: Replace index key with unique id.
   ```tsx
   items.map(item => <li key={item.id}>{item.name}</li>)
   ```

## Anti-Patterns
- Premature abstraction (interface for single implementation).
- Over-splitting (components shorter than 10 lines extracted to own file).
- Render-prop or HOC when children or hooks work.

## Metrics
- component_count (total number of components)
- max_component_lines (longest single component)
- circular_deps_count
- unnamed_export_ratio

## Failure Modes
- False positive on large generated files (lottie, codegen).
- CRA pages that are legitimately large (setup pages).
- Vendor components in node_modules.

## Example Finding
```json
{
  "id": "F-AR-0001",
  "agent": "A1",
  "severity": "P2",
  "title": "PageHeader component exceeds 250 lines and mixes multiple concerns",
  "evidence": [{ "file": "src/components/PageHeader.tsx", "line": 1, "snippet": "function PageHeader() { ... } // 312 lines", "measurement": "312 lines" }],
  "impact": 3,
  "effort": 3,
  "fix_sketch": "Extract SearchBar, UserMenu, and Breadcrumbs into separate component files with props interfaces.",
  "metric": { "name": "max_component_lines", "before": 312, "after_null_ok": false, "unit": "lines" },
  "files_touched": ["src/components/PageHeader.tsx", "src/components/SearchBar.tsx", "src/components/UserMenu.tsx", "src/components/Breadcrumbs.tsx"],
  "status": "open"
}
```
