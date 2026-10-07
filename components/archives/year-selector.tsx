"use client";

import { useRouter } from "next/navigation";

export default function YearSelector({ defaultValue, availableYears }: { defaultValue: number, availableYears: number[] }) {
  const router = useRouter();
  
  return (
    <select 
      name="year" 
      defaultValue={defaultValue}
      onChange={(e) => {
        router.push(`/archives?year=${e.target.value}`);
      }}
      className="form-select bg-white py-1 px-3"
    >
      {availableYears.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
