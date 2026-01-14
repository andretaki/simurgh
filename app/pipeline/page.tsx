"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PipelineTabs } from "@/components/pipeline/PipelineTabs";
import { ActionRequiredList } from "@/components/pipeline/ActionRequiredList";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  actionRequired: number;
  rfqs: number;
  orders: number;
}

interface ActionGroup {
  id: string;
  label: string;
  items: ActionItem[];
}

interface ActionItem {
  type: "rfq" | "order";
  id: number;
  identifier: string;
  title: string;
  subtitle: string;
  value: string | null;
  dueDate: string | null;
  urgency: "urgent" | "attention" | "ready";
  meta: string[];
  actions: { label: string; href: string }[];
}

function PipelineContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "action-required";

  const [stats, setStats] = useState<Stats>({ actionRequired: 0, rfqs: 0, orders: 0 });
  const [actionGroups, setActionGroups] = useState<ActionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, actionsRes] = await Promise.all([
        fetch("/api/pipeline/stats"),
        fetch("/api/pipeline/action-required"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (actionsRes.ok) {
        const data = await actionsRes.json();
        setActionGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch pipeline data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "action-required", label: "Action Required", count: stats.actionRequired },
    { id: "rfqs", label: "RFQs", count: stats.rfqs },
    { id: "orders", label: "Orders", count: stats.orders },
    { id: "archive", label: "Archive" },
  ];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
            <p className="text-slate-500">Quick overview of what needs attention</p>
          </div>
          <div className="text-sm text-slate-500">{today}</div>
        </div>

        {/* Tabs */}
        <Card className="mb-6">
          <PipelineTabs tabs={tabs} activeTab={activeTab} />
          <CardContent className="p-6">
            {activeTab === "action-required" && (
              <ActionRequiredList groups={actionGroups} loading={loading} />
            )}
            {activeTab === "rfqs" && (
              <div className="text-center py-12 text-slate-500">
                RFQs list coming soon...
              </div>
            )}
            {activeTab === "orders" && (
              <div className="text-center py-12 text-slate-500">
                Orders list coming soon...
              </div>
            )}
            {activeTab === "archive" && (
              <div className="text-center py-12 text-slate-500">
                Archive coming soon...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PipelineContent />
    </Suspense>
  );
}
