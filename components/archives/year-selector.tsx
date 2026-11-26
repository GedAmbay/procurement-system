"use client";

import { useRouter } from "next/navigation";
import CustomSelect from "@/components/ui/custom-select";

export default function YearSelector({
  defaultValue,
  availableYears,
}: {
  defaultValue: number;
  availableYears: number[];
}) {
  const router = useRouter();

  return (
    <div className="w-28">
      <CustomSelect
        name="year"
        size="sm"
        searchable={false}
        value={String(defaultValue)}
        onChange={(val) => router.push(`/archives?year=${val}`)}
        options={availableYears.map((y) => ({
          value: String(y),
          label: String(y),
        }))}
      />
    </div>
  );
}
