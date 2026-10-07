import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProcurementFolder, deriveStages } from "@/lib/procurement-folder";
import FolderView from "@/components/procurement-folder/folder-view";

export default async function ProcurementFolderPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session) {
    return null;
  }

  const folderData = await getProcurementFolder(params.id);

  if (!folderData) {
    notFound();
  }

  const stages = deriveStages(folderData);

  // We need to pass data to a client component, so we must serialize dates
  // A simple JSON parse/stringify works well for dates -> strings
  const serializedFolder = JSON.parse(JSON.stringify(folderData));

  return (
    <FolderView
      folderData={serializedFolder}
      stages={stages}
    />
  );
}
