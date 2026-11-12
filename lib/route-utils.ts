/**
 * Route utilities for identifying editor / live-preview document routes.
 * On these routes, the sidebar defaults to a collapsed 72px rail and breadcrumbs are omitted.
 */

// Patterns representing full-screen editor or live-preview document pages
const EDITOR_ROUTE_PATTERNS = [
  /^\/rfqs\/[^\/]+$/,                     // RFQ live preview / edit
  /^\/purchase-requests\/[^\/]+$/,        // PR live preview / edit
  /^\/purchase-orders\/[^\/]+$/,          // PO live preview / edit
  /^\/acceptances\/[^\/]+$/,              // Acceptance & Inspection document
  /^\/abstract\/[^\/]+\/(preview|print)$/,    // Abstract live preview / print only
];

export function isEditorRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return EDITOR_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

