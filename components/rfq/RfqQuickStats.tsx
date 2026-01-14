"use client";

import React, { useEffect, useState } from "react";
import { Clock, FileText, Trophy, AlertTriangle, Loader2 } from "lucide-react";

interface Stats {
  totalOpen: number;
  dueSoon: number;
  dueToday: number;
  recentWins: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "red" | "amber" | "green" | "gray";
  highlight?: boolean;
}

function StatCard({ icon, label, value, color, highlight }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    red: "bg-red-50 text-red-600 border-red-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    green: "bg-green-50 text-green-600 border-green-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses[color]} ${
        highlight ? "ring-2 ring-red-400 animate-pulse" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

export function RfqQuickStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rfq/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data) => setStats(data))
      .catch((err) => {
        console.error("Stats fetch error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silently fail - not critical for the workflow
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={<FileText className="h-5 w-5" />}
        label="Open RFQs"
        value={stats.totalOpen}
        color="blue"
      />
      <StatCard
        icon={<AlertTriangle className="h-5 w-5" />}
        label="Due Today"
        value={stats.dueToday}
        color={stats.dueToday > 0 ? "red" : "gray"}
        highlight={stats.dueToday > 0}
      />
      <StatCard
        icon={<Clock className="h-5 w-5" />}
        label="Due This Week"
        value={stats.dueSoon}
        color={stats.dueSoon > 0 ? "amber" : "gray"}
      />
      <StatCard
        icon={<Trophy className="h-5 w-5" />}
        label="Won (30 days)"
        value={stats.recentWins}
        color="green"
      />
    </div>
  );
}
