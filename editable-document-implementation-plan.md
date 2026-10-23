# Implementation plan: configurable document templates (Purchase Request, Annex 30)

## Context

The system is a Next.js (App Router, TypeScript) app with a "Purchase Requests > Live Preview" page. That page currently renders the Annex 30 Purchase Request form with a hard-coded layout. The form is a fixed government document made of text, a header info grid, an items table (minimum 21 rows, total row), a purpose box and a three-column signatory footer.

Goal: let an admin create and edit the document layout without code changes, and have published templates render in the existing live preview, print output and admin canvas. The admin can also create a template by importing the existing Excel (.xlsx) version of the form.

## Guiding rules (apply to every phase)

1. Layout is data. A template is JSON validated by Zod. No layout lives in JSX once migrated.
2. One renderer. `DocumentRenderer` is used by the live preview, the print view and the admin editor canvas. Never fork it.
3. Layout and data are separate. Templates only reference data through whitelisted binding paths such as `{{pr.number}}`. No expression evaluation.
4. Published template versions are immutable. Each PR stores the `templateVersionId` it was created with, so old PRs always print the same way.
5. The first migrated result must look identical to the current hard-coded Annex 30 preview. Compare screenshots before moving on.
6. Do not break existing pages or the right-hand PR details panel. That panel edits data, not layout.
7. Use the project's existing ORM, UI library, auth and conventions. Inspect them first and adapt this plan. Do not introduce a second one.

## Suggested stack (add only what is missing)

- Zod (schemas), Zustand + Immer (editor state, undo/redo), dnd-kit (drag and drop), ExcelJS (import/export), a debounce utility.
- Existing database and ORM (the examples assume Postgres with JSONB).

## Target folder structure

```
src/
  features/document-templates/
    schema/            # zod schemas + inferred types
      template.ts
      sections.ts
      bindings.ts      # whitelist of allowed binding paths
    renderer/
      DocumentRenderer.tsx
      PageFrame.tsx    # fixed physical page size, scale support
      sections/        # TitleBlock, CellGrid, ItemsTable, TextBox, SignatoryTable
      resolveBinding.ts
      formatters.ts    # money, date
    editor/
      store.ts         # zustand store, undo/redo
      TemplateEditor.tsx
      SectionOutline.tsx
      EditorCanvas.tsx
      properties/      # one form per section type
      useAutosave.ts
    import/
      xlsxToTemplate.ts
      detectPlaceholders.ts
    server/
      queries.ts
      actions.ts
  app/
    (admin)/templates/page.tsx
    (admin)/templates/[id]/edit/page.tsx
    api/templates/import/route.ts
```

Adjust paths to match the repo's existing layout.

---

## Phase 0: Discovery and setup

Tasks
- Read the current Live Preview page and the component that renders Annex 30. List every piece of text, every field it reads, and its dimensions.
- Identify the existing data model for a Purchase Request (fields, items, signatories) and the auth/role check used for admin pages.
- Install missing dependencies.
- Add a feature folder per the structure above.

Done when
- A short notes file lists the PR fields available for binding and the existing auth helper to protect admin routes.

## Phase 1: Template schema

Tasks
- Define `templateSchema` with: `version`, `page` (size, orientation, margins, fontFamily, fontSize) and `sections[]`.
- Define section types as a discriminated union on `type`, each with a stable `id`:
  - `titleBlock` (annex label, title, subtitle)
  - `cellGrid` (column widths, rows of cells with label/value/colSpan/rowSpan, border options)
  - `itemsTable` (source, minRows, columns[], totalRow, repeatHeader)
  - `textBox` (label, value, lines)
  - `signatoryTable` (columns[] with title, name, designation)
  - `staticText` (text, align, style)
- Column definition: `key`, `label`, `width`, `align`, `format` (text | number | money | date).
- Create `bindings.ts` with the whitelist of allowed paths (for example `pr.number`, `pr.date`, `pr.office.name`, `pr.purpose`, `pr.items`, `pr.requestedBy.name`, `lgu.name`). Export a validator that rejects unknown paths.
- Write the current Annex 30 as a seed template JSON in the new schema.

Done when
- The seed template parses with Zod, and unit tests cover valid and invalid templates, including unknown binding paths.

## Phase 2: Renderer

Tasks
- Build `PageFrame` at a fixed physical size (A4 at 96 dpi by default, from `page`) and support a `scale` prop using `transform: scale()` for the 60% zoom view.
- Build `resolveBinding(path, data)` and `formatters`.
- Build one component per section type and a registry mapping `type` to component.
- Build `DocumentRenderer({ template, data, mode })` where `mode` is `view` or `edit`. In `edit` mode, sections are wrapped so they can be selected.
- `itemsTable` renders real rows, then blank filler rows up to `minRows`, then the total row (sum of the configured column).
- Add print CSS (`@page` size and margins, `print-color-adjust: exact`).

Done when
- Rendering the seed template with a real PR matches a screenshot of the current hard-coded preview (layout, borders, fonts, totals).

## Phase 3: Data model and server actions

Tasks
- Tables:
  - `document_templates` (id, key, name, currentPublishedVersionId, createdBy, timestamps)
  - `document_template_versions` (id, templateId, versionNumber, status `draft|published`, schemaJson, sourceXlsxUrl nullable, createdBy, publishedAt)
  - Add `templateVersionId` to the Purchase Request table.
- Server actions or route handlers: list templates, get a version, save draft (validates with Zod), publish (creates an immutable published version and updates the pointer), duplicate a version into a new draft.
- On PR creation (or submission, whichever the system treats as final), set `templateVersionId` to the current published version.
- Migration/backfill: create a template from the seed JSON, publish it as v1, and assign existing PRs to it.
- Protect all admin actions with the existing admin role check.

Done when
- A draft can be saved and published through the actions, and existing PRs resolve to v1.

## Phase 4: Wire the live preview

Tasks
- Replace the hard-coded Annex 30 component in the Live Preview page with `DocumentRenderer`, loading the PR's `templateVersionId` version.
- Keep the zoom controls, the rows control and the Print button working (print uses the same renderer).
- Keep the right-hand details panel unchanged. Data edits there must re-render the preview live.

Done when
- The Live Preview page looks and behaves exactly as before, driven by template JSON.

## Phase 5: Admin editor

Tasks
- Routes: templates list, and `/templates/[id]/edit`.
- Zustand store holding `draft` JSON, `selectedSectionId`, and history for undo/redo (Immer patches or snapshots, capped).
- Layout: top bar (name, draft badge, Edit / Preview-with-sample-PR toggle, undo, redo, Save draft, Publish), left panel (section outline with dnd-kit reordering, Add section, bindable field list), center canvas (`DocumentRenderer` in `edit` mode with selection outline), right panel (properties form for the selected section).
- Properties forms per section type, generated from or aligned with the Zod schemas. For `itemsTable`: data source, min rows, total row toggle, repeat header toggle, reorderable columns with label, width, align and format.
- Inline editing of static text by clicking it. Binding picker that inserts only whitelisted fields.
- Autosave: debounced (about 800 ms) save of the draft, with a visible Saved / Saving / Error state. Validate before saving and show Zod errors next to the field.
- Preview mode renders the draft with a sample or selected real PR.
- Publish: confirmation dialog, creates a new version, shows the version number.

Done when
- An admin can reorder sections, change columns and min rows, edit text, bind fields, undo/redo, save, preview and publish. A newly published version appears in the live preview for new PRs only.

## Phase 6: Excel import

Tasks
- Upload control in the templates list and editor.
- `POST /api/templates/import` (admin only): parse the first worksheet with ExcelJS and return a validated draft template.
- Converter `xlsxToTemplate`:
  - Column widths (characters to px) and row heights (points to px).
  - Merged ranges to `colSpan`/`rowSpan`.
  - Per-cell value, font (family, size, bold, italic, underline), alignment and borders.
  - Page setup (paper size, orientation, margins) to `page`.
  - Images saved to storage and referenced by URL.
- `detectPlaceholders`: cells containing `{{path}}` become bindings. Unknown paths are flagged, not silently accepted.
- Repeating row detection: a row containing `{{items.*}}` placeholders becomes an `itemsTable` row template, with `minRows` set from an editor field.
- Formulas are not imported. Replace them with a computed total bound to the table's total configuration.
- Return an import report listing anything skipped (conditional formatting, charts, shapes, rich text in cells) and show it to the admin.
- Store the uploaded file URL in `sourceXlsxUrl` on the draft version.

Done when
- Importing the Annex 30 workbook gives a draft that renders close to the original in the editor, with placeholders already bound.

## Phase 7: Pagination and print

Tasks
- Decide behavior when items exceed `minRows`: the table grows and continues on additional pages, repeating the header, with the signatory block on the last page. Implement with CSS fragmentation (`break-inside: avoid` on rows) and test in print preview.
- Make print output independent of the on-screen zoom.

Done when
- A PR with 5, 21 and 60 items prints correctly on A4.

## Phase 8: Optional Excel export

Tasks
- Walk the template and a PR's data with ExcelJS to produce an .xlsx that matches the layout (widths, merges, borders, values).

## Testing and QA

- Unit tests: schema validation, binding whitelist, `resolveBinding`, formatters, total calculation, xlsx converter (use fixture workbooks).
- Component tests: each section renders with sample data, filler rows to `minRows`.
- E2E: edit a template, save, publish, create a PR, check the preview; confirm an older PR still uses its old version.
- Visual check: screenshot comparison of the seed template against the original preview and against the Excel file.
- Security: admin-only routes, Zod validation on every write, file type and size limits on upload, sanitize any HTML-capable fields.

## Acceptance checklist

- [ ] Seed template reproduces the current Annex 30 preview.
- [ ] Live preview, print and editor canvas share one renderer.
- [ ] Admin can edit text, columns, min rows, signatories and field bindings without code.
- [ ] Draft and publish flow works, and published versions are immutable.
- [ ] Each PR keeps the template version it was created with.
- [ ] Excel import produces a usable draft with an import report.
- [ ] Printing is correct for short and long item lists.
- [ ] Tests and type checks pass.

## Notes for the agent

- Work one phase at a time, and finish each phase's "Done when" before starting the next.
- Before each phase, summarize the files you plan to create or change.
- Keep commits small and phase-scoped.
- If the existing codebase has a different convention than this plan, follow the codebase and note the deviation.
