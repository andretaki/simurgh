"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabConfig {
  id: string;
  label: string;
  count?: number;
}

interface PipelineTabsProps {
  tabs: TabConfig[];
  activeTab: string;
}

export function PipelineTabs({ tabs, activeTab }: PipelineTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "action-required") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    router.push(`/pipeline?${params.toString()}`);
  };

  return (
    <div className="border-b border-slate-200">
      <nav className="flex gap-1" aria-label="Pipeline tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-slate-900 border-b-2 border-slate-900 -mb-px"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-2 px-1.5 py-0.5 rounded text-xs",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
