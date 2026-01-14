"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Filter, Package } from "lucide-react";

interface LineItem {
  lineNumber: string;
  description: string;
  quantity: number;
  unit: string;
  nsn: string;
}

interface Opportunity {
  id: number;
  solicitationNumber: string;
  title: string;
  agency: string | null;
  office: string | null;
  postedDate: string | null;
  responseDeadline: string | null;
  naicsCode: string | null;
  setAsideType: string | null;
  uiLink: string | null;
  relevanceScore: number;
  matchedKeyword: string | null;
  matchedFsc: string | null;
  matchedNsns: string[] | null;
  status: string;
  quantity: string | null;
  lineItems: LineItem[] | null;
  fullDescription: string | null;
  pocName: string | null;
  pocEmail: string | null;
}

// FSC code names for display
const FSC_NAMES: Record<string, string> = {
  '6810': 'Chemicals',
  '9150': 'Oils & Greases',
  '6850': 'Chemical Specialties',
  '8010': 'Paints/Varnishes',
  '9160': 'Misc Wax/Oils',
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "high" | "nsn" | "fsc">("nsn");
  const [stats, setStats] = useState<{ total: number; high: number; nsnMatch: number; fscMatch: number }>({
    total: 0,
    high: 0,
    nsnMatch: 0,
    fscMatch: 0,
  });

  useEffect(() => {
    fetchOpportunities();
  }, [filter]);

  async function fetchOpportunities() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "high") params.set("minScore", "50");
      if (filter === "nsn") params.set("nsnOnly", "true");
      if (filter === "fsc") params.set("fscOnly", "true");

      const res = await fetch(`/api/opportunities?${params}`);
      const data = await res.json();

      if (data.success) {
        setOpportunities(data.data.opportunities);
        setStats(data.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch opportunities:", err);
    } finally {
      setLoading(false);
    }
  }

  async function syncOpportunities() {
    setSyncing(true);
    try {
      const res = await fetch("/api/opportunities/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchOpportunities();
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }

  function getScoreBadge(score: number) {
    if (score >= 80) return <Badge className="bg-green-600">Hot Lead</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-600">Good Match</Badge>;
    return <Badge variant="secondary">Low Match</Badge>;
  }

  function getSetAsideBadge(setAside: string | null) {
    if (!setAside || setAside === "None" || setAside === "NONE") return null;
    const colors: Record<string, string> = {
      SBA: "bg-blue-600",
      SDVOSBC: "bg-purple-600",
      SDVOSBS: "bg-purple-600",
      WOSB: "bg-pink-600",
      EDWOSB: "bg-pink-600",
      HUBZone: "bg-orange-600",
    };
    return <Badge className={colors[setAside] || "bg-gray-600"}>{setAside}</Badge>;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  }

  function getDaysUntil(dateStr: string | null) {
    if (!dateStr) return null;
    const deadline = new Date(dateStr);
    const now = new Date();
    const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }

  function parseQuantityFromTitle(title: string): string | null {
    // Match patterns like "5GL", "100 EA", "50 GAL", etc.
    const match = title.match(/(\d+)\s*(GL|GAL|GALLON|EA|EACH|LB|CS|CASE|BX|BOX|DR|DRUM|PT|QT|OZ|KG|L|ML)/i);
    if (match) {
      return `${match[1]} ${match[2].toUpperCase()}`;
    }
    return null;
  }

  // Parse key details from description - what you actually need to bid
  function parseKeyDetails(desc: string | null | undefined): Record<string, string> {
    if (!desc) return {};
    const details: Record<string, string> = {};
    const text = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Part Number - the key product identifier
    const pnMatch = text.match(/P\/N[:\s]*([A-Z0-9-]+)/i) ||
                    text.match(/part number[:\s]*([A-Z0-9-]+)/i) ||
                    text.match(/on part number ([A-Z0-9-]+)/i);
    if (pnMatch) details["pn"] = pnMatch[1];

    // CAGE code
    const cageMatch = text.match(/CAGE[:\s]*([A-Z0-9]{5})/i) ||
                      text.match(/cage\s+([A-Z0-9]{5})/i);
    if (cageMatch) details["cage"] = cageMatch[1];

    // Container size
    const containerMatch = text.match(/(\d+)\s*(gallon|gal|quart|qt)s?\s*(cans?|drums?|pails?)?/i) ||
                           text.match(/size of each (?:can|container|drum) is (\d+)\s*(gallon|gal)/i);
    if (containerMatch) {
      details["container"] = `${containerMatch[1]} ${containerMatch[2].toUpperCase().replace('GALLON', 'GAL')}`;
    }

    // MIL product specs (not marking standards)
    const milSpecs = text.match(/MIL-(?:G|PRF|L|H|C|DTL|A|O)-\d+[A-Z]?/gi);
    if (milSpecs) details["spec"] = [...new Set(milSpecs.map(s => s.toUpperCase()))].join(", ");

    // Fed spec
    const fedMatch = text.match(/(O-[A-Z]-\d+[A-Z]?)/i) || text.match(/(A-A-\d+[A-Z]?)/i);
    if (fedMatch) details["fedspec"] = fedMatch[1].toUpperCase();

    // Drawing
    const drawMatch = text.match(/(?:DRAWING|DWG)[:\s#]*(\d{5,}[-\d]*)/i);
    if (drawMatch) details["drawing"] = drawMatch[1];

    // Delivery
    const delMatch = text.match(/DELIVERY\s+(\d+)\s*(DAYS?)/i);
    if (delMatch) details["delivery"] = `${delMatch[1]}d`;

    // Shelf life code
    const shelfMatch = text.match(/requirement\s+\(([A-Z]\s*[A-Z]{1,2})\)/i);
    if (shelfMatch) details["shelf"] = shelfMatch[1].replace(/\s+/g, '');

    // NSN
    const nsnMatch = text.match(/(\d{4}-\d{2}-\d{3}-\d{4})/);
    if (nsnMatch) details["nsn"] = nsnMatch[1];

    return details;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SAM.gov Opportunities</h1>
          <p className="text-muted-foreground">
            Matched to your NSN catalog (229 products in FSC 6810, 9150, 6850)
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/nsn-catalog">
            <Button variant="outline">
              <Package className="mr-2 h-4 w-4" />
              NSN Catalog
            </Button>
          </Link>
          <Button onClick={syncOpportunities} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "nsn" ? "default" : "outline"}
          onClick={() => setFilter("nsn")}
          className={filter === "nsn" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          <Package className="mr-2 h-4 w-4" />
          Your NSNs ({stats.nsnMatch})
        </Button>
        <Button
          variant={filter === "fsc" ? "default" : "outline"}
          onClick={() => setFilter("fsc")}
          className={filter === "fsc" ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          FSC Match ({stats.fscMatch})
        </Button>
        <Button
          variant={filter === "high" ? "default" : "outline"}
          onClick={() => setFilter("high")}
        >
          <Filter className="mr-2 h-4 w-4" />
          High Score ({stats.high})
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All ({stats.total})
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading opportunities...</div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No opportunities found</p>
          <Button onClick={syncOpportunities} className="mt-4">
            Sync from SAM.gov
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => {
            const daysUntil = getDaysUntil(opp.responseDeadline);
            const isUrgent = daysUntil !== null && daysUntil <= 7;
            const quantity = opp.quantity || parseQuantityFromTitle(opp.title);
            const keyInfo = parseKeyDetails(opp.fullDescription);
            const hasKeyInfo = Object.keys(keyInfo).length > 0;

            return (
              <Card key={opp.id} className={`${isUrgent ? "border-red-500" : ""} cursor-pointer hover:shadow-md transition-shadow`}>
                <Link href={`/opportunities/${opp.id}`} className="block">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          {opp.solicitationNumber}
                        </CardTitle>
                        {quantity && (
                          <Badge variant="outline" className="font-mono text-sm">{quantity}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{opp.title}</p>
                    </div>
                    <div className="flex gap-2 items-center flex-shrink-0">
                      {getScoreBadge(opp.relevanceScore)}
                      {getSetAsideBadge(opp.setAsideType)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Match Reason Display */}
                  {opp.matchedNsns && opp.matchedNsns.length > 0 ? (
                    <div className="mb-3 p-2 bg-green-50 border border-green-300 rounded">
                      <span className="text-xs text-green-700 font-semibold">MATCH: Your NSN Catalog </span>
                      <span className="font-mono text-sm text-green-800">
                        {opp.matchedNsns.slice(0, 3).join(", ")}
                        {opp.matchedNsns.length > 3 && ` +${opp.matchedNsns.length - 3} more`}
                      </span>
                    </div>
                  ) : opp.matchedFsc ? (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-300 rounded">
                      <span className="text-xs text-blue-700 font-semibold">MATCH: FSC {opp.matchedFsc} </span>
                      <span className="text-sm text-blue-600">
                        ({FSC_NAMES[opp.matchedFsc] || 'Product Category'})
                      </span>
                    </div>
                  ) : opp.matchedKeyword ? (
                    <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="text-xs text-gray-600">
                        MATCH: {opp.matchedKeyword}
                      </span>
                    </div>
                  ) : null}

                  {/* Key Product Info - What you're actually bidding on */}
                  {hasKeyInfo && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded flex flex-wrap gap-3 text-sm">
                      {keyInfo.pn && (
                        <div>
                          <span className="text-muted-foreground">P/N:</span>{" "}
                          <span className="font-mono font-bold text-blue-700">{keyInfo.pn}</span>
                        </div>
                      )}
                      {keyInfo.cage && (
                        <div>
                          <span className="text-muted-foreground">CAGE:</span>{" "}
                          <span className="font-mono font-semibold">{keyInfo.cage}</span>
                        </div>
                      )}
                      {keyInfo.container && (
                        <div>
                          <span className="text-muted-foreground">Size:</span>{" "}
                          <span className="font-semibold">{keyInfo.container}</span>
                        </div>
                      )}
                      {keyInfo.spec && (
                        <div>
                          <span className="text-muted-foreground">Spec:</span>{" "}
                          <span className="font-semibold text-green-700">{keyInfo.spec}</span>
                        </div>
                      )}
                      {keyInfo.fedspec && (
                        <div>
                          <span className="text-muted-foreground">Fed:</span>{" "}
                          <span className="font-semibold text-green-700">{keyInfo.fedspec}</span>
                        </div>
                      )}
                      {keyInfo.drawing && (
                        <div>
                          <span className="text-muted-foreground">Dwg:</span>{" "}
                          <span className="font-mono">{keyInfo.drawing}</span>
                        </div>
                      )}
                      {keyInfo.nsn && (
                        <div>
                          <span className="text-muted-foreground">NSN:</span>{" "}
                          <span className="font-mono text-xs">{keyInfo.nsn}</span>
                        </div>
                      )}
                      {keyInfo.delivery && (
                        <div>
                          <span className="text-muted-foreground">Del:</span>{" "}
                          <span className="text-orange-600">{keyInfo.delivery}</span>
                        </div>
                      )}
                      {keyInfo.shelf && (
                        <div>
                          <span className="text-muted-foreground">Shelf:</span>{" "}
                          <span>{keyInfo.shelf}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Line Items - only show if no key info parsed */}
                  {!hasKeyInfo && opp.lineItems && opp.lineItems.length > 0 && (
                    <div className="mb-3 p-2 bg-muted/50 rounded text-sm">
                      <div className="font-medium mb-1">Line Items:</div>
                      {opp.lineItems.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex gap-4">
                          {item.nsn && <span className="font-mono text-xs">{item.nsn}</span>}
                          <span>{item.quantity} {item.unit}</span>
                          {item.description && <span className="text-muted-foreground">{item.description.substring(0, 50)}</span>}
                        </div>
                      ))}
                      {opp.lineItems.length > 3 && (
                        <div className="text-muted-foreground text-xs">+{opp.lineItems.length - 3} more items</div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">NAICS:</span>{" "}
                      {opp.naicsCode || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Posted:</span>{" "}
                      {formatDate(opp.postedDate)}
                    </div>
                    <div className={isUrgent ? "text-red-500 font-semibold" : ""}>
                      <span className="text-muted-foreground">Due:</span>{" "}
                      {formatDate(opp.responseDeadline)}
                      {daysUntil !== null && (
                        <span className="ml-1">
                          ({daysUntil <= 0 ? "EXPIRED" : `${daysUntil}d`})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact:</span>{" "}
                      {opp.pocEmail ? (
                        <a href={`mailto:${opp.pocEmail}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {opp.pocName || opp.pocEmail}
                        </a>
                      ) : "N/A"}
                    </div>
                    <div>
                      {opp.uiLink && (
                        <a
                          href={opp.uiLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          SAM.gov
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
