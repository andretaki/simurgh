"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Upload, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

interface NsnEntry {
  id: number;
  nsn: string;
  fsc: string;
  productName: string | null;
  lastBidPrice: string | null;
  lastBidDate: string | null;
  bidCount: number;
}

interface NsnMatch {
  nsn: string;
  opportunities: Array<{
    solicitationNumber: string;
    title: string;
    responseDeadline: string;
    uiLink: string;
  }>;
}

interface ImportResult {
  imported: number;
  total: number;
  duplicatesInBatch: number;
  parseErrors: number;
  byFsc: Record<string, number>;
  sampleErrors: string[];
}

const FSC_NAMES: Record<string, string> = {
  "6810": "Chemicals",
  "9150": "Oils & Greases",
  "6850": "Chemical Specialties",
  "8010": "Paints/Varnishes",
  "9160": "Misc Wax/Oils",
};

export default function NsnCatalogPage() {
  const [nsns, setNsns] = useState<NsnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFsc, setSelectedFsc] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<NsnMatch[]>([]);
  const [stats, setStats] = useState<{ total: number; byFsc: Record<string, number> }>({
    total: 0,
    byFsc: {},
  });

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    fetchNsns();
  }, []);

  async function fetchNsns() {
    setLoading(true);
    try {
      const res = await fetch("/api/nsn-catalog");
      const data = await res.json();
      if (data.success) {
        setNsns(data.data.nsns);
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch NSN catalog:", err);
    } finally {
      setLoading(false);
    }
  }

  async function searchForBids() {
    setSearching(true);
    setMatches([]);
    try {
      const nsnsToSearch = filteredNsns.slice(0, 20); // Limit to 20 for performance
      const res = await fetch("/api/nsn-catalog/search-bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nsns: nsnsToSearch.map((n) => n.nsn) }),
      });
      const data = await res.json();
      if (data.success) {
        setMatches(data.data.matches);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const res = await fetch("/api/nsn-catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json();

      if (data.success) {
        setImportResult(data.data);
        // Refresh the catalog
        fetchNsns();
      } else {
        setImportError(data.error || "Import failed");
      }
    } catch (err) {
      setImportError("Failed to import NSNs");
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  }

  function resetImportModal() {
    setImportText("");
    setImportResult(null);
    setImportError(null);
  }

  const filteredNsns = nsns.filter((n) => {
    if (searchTerm && !n.nsn.includes(searchTerm)) return false;
    if (selectedFsc && n.fsc !== selectedFsc) return false;
    return true;
  });

  const fscCounts = Object.entries(stats.byFsc).sort((a, b) => b[1] - a[1]);

  // Count lines in import text for preview
  const lineCount = importText.trim() ? importText.trim().split(/[\n\r,\t]+/).filter(l => l.trim()).length : 0;

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">NSN Catalog</h1>
          <p className="text-muted-foreground">
            {stats.total} products you bid on
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={(open) => {
            setImportOpen(open);
            if (!open) resetImportModal();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import NSNs
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import NSNs</DialogTitle>
                <DialogDescription>
                  Paste NSNs below (one per line, comma-separated, or tab-separated from Excel).
                  Supports formats: 6810-00-286-5435 or 6810002865435
                </DialogDescription>
              </DialogHeader>

              {!importResult ? (
                <>
                  <Textarea
                    placeholder="Paste NSNs here...&#10;6810-00-286-5435&#10;9150-00-273-2374&#10;6810-00-052-1371"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  {lineCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Found approximately {lineCount} entries to import
                    </p>
                  )}
                  {importError && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {importError}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setImportOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                      {importing ? "Importing..." : `Import ${lineCount} NSNs`}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Import Complete</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-4 rounded">
                        <div className="text-2xl font-bold">{importResult.imported}</div>
                        <div className="text-sm text-muted-foreground">NSNs Imported</div>
                      </div>
                      <div className="bg-muted p-4 rounded">
                        <div className="text-2xl font-bold">{importResult.total}</div>
                        <div className="text-sm text-muted-foreground">Total Entries</div>
                      </div>
                    </div>

                    {Object.keys(importResult.byFsc).length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">By Product Category:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(importResult.byFsc).map(([fsc, count]) => (
                            <Badge key={fsc} variant="secondary">
                              {FSC_NAMES[fsc] || fsc}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {importResult.parseErrors > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {importResult.parseErrors} entries could not be parsed
                        {importResult.sampleErrors.length > 0 && (
                          <div className="mt-1 font-mono text-xs">
                            Examples: {importResult.sampleErrors.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button onClick={() => setImportOpen(false)}>
                      Done
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Button onClick={searchForBids} disabled={searching}>
            <Search className={`mr-2 h-4 w-4 ${searching ? "animate-pulse" : ""}`} />
            {searching ? "Searching SAM.gov..." : "Find Matching Bids"}
          </Button>
        </div>
      </div>

      {/* FSC Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={selectedFsc === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedFsc(null)}
        >
          All ({stats.total})
        </Button>
        {fscCounts.map(([fsc, count]) => (
          <Button
            key={fsc}
            variant={selectedFsc === fsc ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFsc(selectedFsc === fsc ? null : fsc)}
          >
            {FSC_NAMES[fsc] || fsc} ({count})
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search NSN (e.g., 6810-00-286)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Matching Opportunities */}
      {matches.length > 0 && (
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600">
              Found {matches.reduce((acc, m) => acc + m.opportunities.length, 0)} Matching Bids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.nsn} className="border-b pb-4 last:border-0">
                  <div className="font-mono font-semibold mb-2">{match.nsn}</div>
                  {match.opportunities.map((opp) => (
                    <div
                      key={opp.solicitationNumber}
                      className="flex justify-between items-center py-1 pl-4"
                    >
                      <div>
                        <span className="font-medium">{opp.solicitationNumber}</span>
                        <span className="text-muted-foreground ml-2">
                          {opp.title.substring(0, 50)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          Due: {new Date(opp.responseDeadline).toLocaleDateString()}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={opp.uiLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && stats.total === 0 && (
        <Card className="mb-6">
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No NSNs in Catalog</h3>
            <p className="text-muted-foreground mb-4">
              Import your NSNs to start finding matching SAM.gov opportunities
            </p>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import NSNs
            </Button>
          </CardContent>
        </Card>
      )}

      {/* NSN List */}
      {loading ? (
        <div className="text-center py-12">Loading NSN catalog...</div>
      ) : stats.total > 0 ? (
        <div className="grid gap-2">
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div className="col-span-3">NSN</div>
            <div className="col-span-2">FSC</div>
            <div className="col-span-4">Product Name</div>
            <div className="col-span-2 text-right">Last Bid</div>
            <div className="col-span-1 text-right">Bids</div>
          </div>
          {filteredNsns.slice(0, 100).map((nsn) => (
            <div
              key={nsn.id}
              className="grid grid-cols-12 gap-4 px-4 py-2 text-sm hover:bg-muted/50 rounded"
            >
              <div className="col-span-3 font-mono">{nsn.nsn}</div>
              <div className="col-span-2">
                <Badge variant="secondary">{FSC_NAMES[nsn.fsc] || nsn.fsc}</Badge>
              </div>
              <div className="col-span-4 text-muted-foreground">
                {nsn.productName || "-"}
              </div>
              <div className="col-span-2 text-right">
                {nsn.lastBidPrice ? `$${parseFloat(nsn.lastBidPrice).toFixed(2)}` : "-"}
              </div>
              <div className="col-span-1 text-right">{nsn.bidCount}</div>
            </div>
          ))}
          {filteredNsns.length > 100 && (
            <div className="text-center py-4 text-muted-foreground">
              Showing 100 of {filteredNsns.length} NSNs
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
