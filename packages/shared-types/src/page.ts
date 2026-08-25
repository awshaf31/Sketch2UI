export interface Page {
  id: string;
  projectId: string;
  /** User-editable, drives the Pages selector UI — e.g. "Page 1". */
  name: string;
  /** Sort position among the project's pages; also the export filename suffix
   * (order 1 -> index.html, order 2 -> page-2.html, ...). */
  order: number;
  /** Which CodeVersion preview and export use for this page. Unset means "the
   * latest" — mirrors Project.activeCodeVersionId's existing pattern. */
  activeCodeVersionId?: string;
  createdAt: string;
  updatedAt: string;
}
