"use client";

import { CheckSquare } from "lucide-react";

export default function AcceptancePage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inspection and Acceptance</h1>
          <p className="text-slate-500 mt-1">Manage physical Inspection and Acceptance Reports</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <CheckSquare size={40} className="text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Acceptance Module Under Construction</h2>
          <p className="text-slate-500 max-w-md">
            This module is currently a placeholder and will be implemented to handle the Inspection and Acceptance Reports of delivered goods.
          </p>
        </div>
      </div>
    </div>
  );
}
