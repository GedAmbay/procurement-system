export type DocumentType = "Abstract" | "RFQ" | "PR" | "PO";

export interface RecentlyOpenedItem {
  id: string;
  documentId: string;
  documentType: DocumentType;
  title: string;
  officeName: string;
  openedAt: string; // ISO date or formatted relative label
  url: string;
}

export interface ArchiveOffice {
  id: string;
  name: string;
  code: string;
  head: string | null;
  count: number;
  finishedCount: number;
  activeCount: number;
  updatedAt?: string | null;
}

export type StatusFilter = "all" | "active" | "finished";
export type SortOption = "name" | "recent" | "folders";

export interface RecentlyOpenedRowProps {
  items: RecentlyOpenedItem[];
  onViewAll?: () => void;
  className?: string;
  isLoading?: boolean;
}

export interface FolderTileProps {
  office: ArchiveOffice;
  fiscalYear: number;
  isEmpty?: boolean;
  onActionClick?: (office: ArchiveOffice, action: string) => void;
  className?: string;
}

export interface EmptyOfficesGroupProps {
  offices: ArchiveOffice[];
  fiscalYear: number;
  defaultOpen?: boolean;
  onActionClick?: (office: ArchiveOffice, action: string) => void;
  className?: string;
}

export interface ArchivesPageProps {
  archives?: ArchiveOffice[];
  fiscalYear?: number;
  availableYears?: number[];
  initialRecentlyOpened?: RecentlyOpenedItem[];
  isLoading?: boolean;
}

