"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign,
  BarChart3,
  AlertCircle,
  Info,
} from "lucide-react";

interface PriceStatistics {
  count: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  avgUnitPrice: number;
  medianUnitPrice: number;
  recentTrend: "up" | "down" | "stable" | "unknown";
}

interface AwardSummary {
  contractNumber: string;
  awardDate: string;
  totalValue: number;
  unitPrice: number | null;
  quantity: number | null;
  awardeeName: string;
  agency: string;
}

interface PricingResult {
  found: boolean;
  message: string;
  awards: AwardSummary[];
  statistics: PriceStatistics | null;
  confidence: "high" | "medium" | "low" | "none";
  dataSource: string;
}

interface MarketPricingProps {
  nsn?: string;
  naicsCode?: string;
  onPriceSelect?: (price: number) => void;
}

export function MarketPricing({ nsn, naicsCode, onPriceSelect }: MarketPricingProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!nsn && !naicsCode) return;

    const fetchPricing = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (nsn) params.set("nsn", nsn);
        if (naicsCode) params.set("naics", naicsCode);

        const response = await fetch(`/api/sam-gov/pricing?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch pricing data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pricing");
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, [nsn, naicsCode]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return (
          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
            High Confidence
          </span>
        );
      case "medium":
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
            Medium Confidence
          </span>
        );
      case "low":
        return (
          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">
            Low Confidence
          </span>
        );
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "stable":
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  // Don't render if no search params
  if (!nsn && !naicsCode) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading market pricing...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border rounded-lg p-3 bg-red-50 border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || !data.found) {
    return (
      <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
        <div className="flex items-center gap-2 text-gray-600">
          <Info className="h-4 w-4" />
          <span className="text-sm">No historical pricing data available</span>
        </div>
      </div>
    );
  }

  const stats = data.statistics;

  return (
    <div className="border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 overflow-hidden">
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm text-blue-900">Market Pricing</span>
            {getConfidenceBadge(data.confidence)}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )}
        </div>

        {/* Quick Stats */}
        {stats && stats.minUnitPrice > 0 && (
          <div className="mt-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">Range:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(stats.minUnitPrice)} - {formatCurrency(stats.maxUnitPrice)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-600">Avg:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(stats.avgUnitPrice)}
              </span>
              {getTrendIcon(stats.recentTrend)}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-blue-200 p-3 space-y-3">
          {/* Statistics Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="text-gray-500">Min Price</div>
                <div className="font-semibold">
                  {stats.minUnitPrice > 0 ? formatCurrency(stats.minUnitPrice) : "N/A"}
                </div>
              </div>
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="text-gray-500">Max Price</div>
                <div className="font-semibold">
                  {stats.maxUnitPrice > 0 ? formatCurrency(stats.maxUnitPrice) : "N/A"}
                </div>
              </div>
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="text-gray-500">Median</div>
                <div className="font-semibold">
                  {stats.medianUnitPrice > 0 ? formatCurrency(stats.medianUnitPrice) : "N/A"}
                </div>
              </div>
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="text-gray-500">Awards Found</div>
                <div className="font-semibold">{stats.count}</div>
              </div>
            </div>
          )}

          {/* Recent Awards */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2">Recent Awards</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.awards.slice(0, 5).map((award, index) => (
                <div
                  key={award.contractNumber + index}
                  className="bg-white rounded p-2 text-xs flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (award.unitPrice && onPriceSelect) {
                      onPriceSelect(award.unitPrice);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{award.awardeeName || "Unknown"}</div>
                    <div className="text-gray-500 truncate">
                      {award.agency} &bull; {formatDate(award.awardDate)}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    {award.unitPrice ? (
                      <div className="font-semibold text-green-700">
                        {formatCurrency(award.unitPrice)}
                        <span className="text-gray-400 font-normal">/unit</span>
                      </div>
                    ) : (
                      <div className="text-gray-600">
                        {formatCurrency(award.totalValue)}
                        <span className="text-gray-400 font-normal"> total</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {stats && stats.avgUnitPrice > 0 && onPriceSelect && (
            <div className="flex gap-2 pt-2 border-t border-blue-100">
              <button
                type="button"
                onClick={() => onPriceSelect(stats.avgUnitPrice)}
                className="flex-1 text-xs bg-blue-600 text-white rounded py-1.5 hover:bg-blue-700 transition-colors"
              >
                Use Average ({formatCurrency(stats.avgUnitPrice)})
              </button>
              <button
                type="button"
                onClick={() => onPriceSelect(stats.medianUnitPrice)}
                className="flex-1 text-xs bg-white text-blue-600 border border-blue-300 rounded py-1.5 hover:bg-blue-50 transition-colors"
              >
                Use Median ({formatCurrency(stats.medianUnitPrice)})
              </button>
            </div>
          )}

          {/* Data Source */}
          <div className="text-[10px] text-gray-400 text-right">
            Source: SAM.gov ({data.dataSource})
          </div>
        </div>
      )}
    </div>
  );
}
