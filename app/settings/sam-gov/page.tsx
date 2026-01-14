"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Save,
  RefreshCw,
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

interface SamGovConfig {
  id?: number;
  naicsCodes: string[];
  keywords: string[];
  excludedKeywords: string[];
  agencies: string[];
  setAsideTypes: string[];
  minValue: number | null;
  enabled: boolean;
  syncIntervalHours: number;
  notificationEmail: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalOpportunitiesFound: number;
}

interface SamGovOpportunity {
  id: number;
  solicitationNumber: string;
  title: string;
  agency: string;
  postedDate: string;
  responseDeadline: string;
  naicsCode: string;
  setAsideType: string | null;
  uiLink: string;
  status: string;
}

const defaultConfig: SamGovConfig = {
  naicsCodes: ["424690"],
  keywords: [],
  excludedKeywords: [],
  agencies: [],
  setAsideTypes: [],
  minValue: null,
  enabled: false,
  syncIntervalHours: 1,
  notificationEmail: "",
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  totalOpportunitiesFound: 0,
};

// Common NAICS codes for chemicals
const NAICS_OPTIONS = [
  { code: "424690", name: "Other Chemical & Allied Products Merchant Wholesalers" },
  { code: "325998", name: "All Other Miscellaneous Chemical Product Manufacturing" },
  { code: "325199", name: "All Other Basic Organic Chemical Manufacturing" },
  { code: "325180", name: "Other Basic Inorganic Chemical Manufacturing" },
  { code: "424610", name: "Plastics Materials and Basic Forms Merchant Wholesalers" },
];

// Set-aside types
const SET_ASIDE_OPTIONS = [
  { code: "SBA", name: "Small Business Set-Aside" },
  { code: "SDVOSBC", name: "Service-Disabled Veteran-Owned Small Business" },
  { code: "WOSB", name: "Women-Owned Small Business" },
  { code: "8A", name: "8(a) Set-Aside" },
  { code: "HUBZone", name: "HUBZone Set-Aside" },
];

export default function SamGovSettingsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SamGovConfig>(defaultConfig);
  const [opportunities, setOpportunities] = useState<SamGovOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(true);

  // Form state for tag inputs
  const [newKeyword, setNewKeyword] = useState("");
  const [newExcludedKeyword, setNewExcludedKeyword] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/sam-gov/config");
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            ...defaultConfig,
            ...data.config,
            naicsCodes: data.config.naicsCodes || ["424690"],
            keywords: data.config.keywords || [],
            excludedKeywords: data.config.excludedKeywords || [],
            agencies: data.config.agencies || [],
            setAsideTypes: data.config.setAsideTypes || [],
          });
        }
        setIsApiKeyConfigured(data.isApiKeyConfigured);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load SAM.gov configuration",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchOpportunities = useCallback(async () => {
    try {
      const response = await fetch("/api/sam-gov/opportunities?limit=20");
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchOpportunities();
  }, [fetchConfig, fetchOpportunities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/sam-gov/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save configuration");
      }

      const data = await response.json();
      setConfig({ ...defaultConfig, ...data.config });

      toast({
        title: "Success",
        description: "SAM.gov configuration saved",
      });
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const response = await fetch("/api/sam-gov/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (data.result) {
        toast({
          title: data.result.success ? "Sync Complete" : "Sync Completed with Issues",
          description: `Found ${data.result.newOpportunities} new opportunities (${data.result.totalFound} total)`,
        });
        fetchConfig();
        fetchOpportunities();
      }
    } catch (error) {
      console.error("Error syncing:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sync opportunities",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleNaicsToggle = (code: string) => {
    setConfig((prev) => ({
      ...prev,
      naicsCodes: prev.naicsCodes.includes(code)
        ? prev.naicsCodes.filter((c) => c !== code)
        : [...prev.naicsCodes, code],
    }));
  };

  const handleSetAsideToggle = (code: string) => {
    setConfig((prev) => ({
      ...prev,
      setAsideTypes: prev.setAsideTypes.includes(code)
        ? prev.setAsideTypes.filter((c) => c !== code)
        : [...prev.setAsideTypes, code],
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !config.keywords.includes(newKeyword.trim())) {
      setConfig((prev) => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  const addExcludedKeyword = () => {
    if (newExcludedKeyword.trim() && !config.excludedKeywords.includes(newExcludedKeyword.trim())) {
      setConfig((prev) => ({
        ...prev,
        excludedKeywords: [...prev.excludedKeywords, newExcludedKeyword.trim()],
      }));
      setNewExcludedKeyword("");
    }
  };

  const removeExcludedKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      excludedKeywords: prev.excludedKeywords.filter((k) => k !== keyword),
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex gap-4 mb-6">
        <Button variant="outline" asChild>
          <Link href="/projects">Projects</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/settings">Company Settings</Link>
        </Button>
      </div>

      {/* API Key Warning */}
      {!isApiKeyConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">SAM.gov API Key Not Configured</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Add your SAM.gov API key to <code className="bg-yellow-100 px-1 rounded">.env.local</code>:
            </p>
            <pre className="bg-yellow-100 p-2 rounded mt-2 text-xs">SAM_GOV_API_KEY=your-key-here</pre>
            <p className="text-sm text-yellow-700 mt-2">
              Get your API key from{" "}
              <a
                href="https://sam.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-900"
              >
                SAM.gov Account Details
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Sync Status Card */}
      <Card className="shadow-lg mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Search className="h-5 w-5" />
              SAM.gov Opportunity Sync
            </CardTitle>
            <Button
              onClick={handleSync}
              disabled={syncing || !isApiKeyConfigured || !config.enabled}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-gray-500">Status</div>
              <div className="font-medium flex items-center gap-1 mt-1">
                {config.enabled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-400" />
                    Disabled
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-gray-500">Last Sync</div>
              <div className="font-medium flex items-center gap-1 mt-1">
                <Clock className="h-4 w-4 text-gray-400" />
                {formatDate(config.lastSyncAt)}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-gray-500">Last Result</div>
              <div className="font-medium mt-1">
                {config.lastSyncStatus === "success" ? (
                  <span className="text-green-600">Success</span>
                ) : config.lastSyncStatus === "partial" ? (
                  <span className="text-yellow-600">Partial</span>
                ) : config.lastSyncStatus === "failed" ? (
                  <span className="text-red-600">Failed</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-gray-500">Total Found</div>
              <div className="font-medium mt-1">{config.totalOpportunitiesFound || 0}</div>
            </div>
          </div>
          {config.lastSyncError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {config.lastSyncError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card className="shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Sync Configuration</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Configure which contract opportunities to monitor from SAM.gov
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="font-medium">Enable Automatic Sync</label>
                <p className="text-sm text-gray-500">Automatically check for new opportunities</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  disabled={!isApiKeyConfigured}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* NAICS Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NAICS Codes to Monitor
              </label>
              <div className="space-y-2">
                {NAICS_OPTIONS.map((option) => (
                  <label key={option.code} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.naicsCodes.includes(option.code)}
                      onChange={() => handleNaicsToggle(option.code)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {option.code} - {option.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Include Keywords (title must contain)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder="Add keyword..."
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center gap-1"
                  >
                    {keyword}
                    <button type="button" onClick={() => removeKeyword(keyword)} className="hover:text-blue-600">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Excluded Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exclude Keywords (skip if contains)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newExcludedKeyword}
                  onChange={(e) => setNewExcludedKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addExcludedKeyword())}
                  placeholder="Add excluded keyword..."
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <Button type="button" variant="outline" onClick={addExcludedKeyword}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.excludedKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm flex items-center gap-1"
                  >
                    {keyword}
                    <button type="button" onClick={() => removeExcludedKeyword(keyword)} className="hover:text-red-600">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Set-Aside Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set-Aside Types (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SET_ASIDE_OPTIONS.map((option) => (
                  <label key={option.code} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.setAsideTypes.includes(option.code)}
                      onChange={() => handleSetAsideToggle(option.code)}
                      className="rounded"
                    />
                    <span className="text-sm">{option.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notification Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification Email
              </label>
              <input
                type="email"
                value={config.notificationEmail}
                onChange={(e) => setConfig((prev) => ({ ...prev, notificationEmail: e.target.value }))}
                placeholder="andre@alliancechemical.com"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Receive email notifications when new opportunities are found
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[160px]">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Opportunities */}
      <Card className="shadow-lg">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowOpportunities(!showOpportunities)}
        >
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold">Recent Opportunities</CardTitle>
            {showOpportunities ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>
        {showOpportunities && (
          <CardContent>
            {opportunities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No opportunities found yet</p>
                <p className="text-sm mt-1">Configure your filters and run a sync to find opportunities</p>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-2">{opp.title}</h4>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                          <span>{opp.solicitationNumber}</span>
                          <span>|</span>
                          <span>{opp.agency}</span>
                          {opp.naicsCode && (
                            <>
                              <span>|</span>
                              <span>NAICS: {opp.naicsCode}</span>
                            </>
                          )}
                          {opp.setAsideType && (
                            <>
                              <span>|</span>
                              <span className="text-blue-600">{opp.setAsideType}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="text-gray-500">Deadline: </span>
                          <span className={opp.responseDeadline ? "font-medium" : "text-gray-400"}>
                            {opp.responseDeadline
                              ? new Date(opp.responseDeadline).toLocaleDateString()
                              : "Not specified"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            opp.status === "new"
                              ? "bg-green-100 text-green-700"
                              : opp.status === "reviewed"
                              ? "bg-blue-100 text-blue-700"
                              : opp.status === "imported"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {opp.status}
                        </span>
                        {opp.uiLink && (
                          <a
                            href={opp.uiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
