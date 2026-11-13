"use client";

import { ArchivesPage } from "./archives-page";
import { ArchiveOffice } from "./types";

interface ArchivesClientProps {
  archives: ArchiveOffice[];
  fiscalYear: number;
  availableYears: number[];
}

export default function ArchivesClient({
  archives,
  fiscalYear,
  availableYears,
}: ArchivesClientProps) {
  return (
    <ArchivesPage
      archives={archives}
      fiscalYear={fiscalYear}
      availableYears={availableYears}
    />
  );
}
