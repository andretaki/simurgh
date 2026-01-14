"use client";

import React, { useState, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, DollarSign, XCircle, History, ArrowRight, Clock } from "lucide-react";

interface PastBidItem {
  itemNumber: number;
  nsn: string | null;
  nsnLast4: string | null;
  description: string | null;
  quantity: number;
  unit: string;
  quotedUnitCost: string | null;
  quotedDeliveryDays: string | null;
  wasNoBid: boolean;
  noBidReason: string | null;
}

interface PastBid {
  id: number;
  rfqNumber: string | null;
  fileName: string;
  createdAt: string;
  agent: { name: string | null };
  items: PastBidItem[];
  responseStatus: string;
  hadResponse: boolean;
}

interface Props {
  onSelectPrice: (unitCost: string, itemIndex?: number) => void;
  currentNsn?: string | null;
  activeLineItemIndex: number;
  lineItemCount: number;
}

export function PastBidSearch({ onSelectPrice, currentNsn, activeLineItemIndex, lineItemCount }: Props) {
  // Start expanded if we have an NSN to search
  const [expanded, setExpanded] = useState(() => !!currentNsn);
  const [nsnSearch, setNsnSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [results, setResults] = useState<PastBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [autoSearched, setAutoSearched] = useState(false);

  // Auto-populate and search when NSN is available
  useEffect(() => {
    if (currentNsn && !autoSearched) {
      const cleaned = currentNsn.replace(/-/g, '');
      const last4 = cleaned.slice(-4);
      setNsnSearch(last4);

      // Auto-search on mount if we have an NSN
      if (last4.length === 4) {
        setAutoSearched(true);
        performSearch(last4, "");
      }
    }
  }, [currentNsn, autoSearched]);

  const performSearch = async (nsn: string, agent: string) => {
    if (!nsn.trim() && !agent.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (nsn.trim()) params.set("nsn", nsn.trim());
      if (agent.trim()) params.set("agent", agent.trim());

      const res = await fetch(`/api/rfq/search-history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => performSearch(nsnSearch, agentSearch);

  const handleApplyPrice = (item: PastBidItem) => {
    if (item.quotedUnitCost) {
      onSelectPrice(item.quotedUnitCost, activeLineItemIndex);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 overflow-hidden shadow-sm">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <History className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <span className="font-semibold text-blue-900">Search Past Bids</span>
            {currentNsn && (
              <span className="text-sm text-blue-600 ml-2">
                (Current NSN: ...{currentNsn.replace(/-/g, '').slice(-4)})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
              {results.length} found
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-blue-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-600" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Active line item indicator */}
          {lineItemCount > 1 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <ArrowRight className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800">
                Price will apply to <strong>Line Item {activeLineItemIndex + 1}</strong>
                {lineItemCount > 1 && ` of ${lineItemCount}`}
              </span>
            </div>
          )}

          {/* Search inputs */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-blue-700 uppercase font-medium">NSN Last 4</label>
              <input
                type="text"
                value={nsnSearch}
                onChange={(e) => setNsnSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="e.g., 7946"
                maxLength={4}
                className="w-full h-10 px-3 mt-1 rounded-lg border border-blue-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-mono text-lg"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-blue-700 uppercase font-medium">Agent Name</label>
              <input
                type="text"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="e.g., Johnson"
                className="w-full h-10 px-3 mt-1 rounded-lg border border-blue-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || (!nsnSearch.trim() && !agentSearch.trim())}
              className="h-10 px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              <Search className="h-4 w-4" />
              {loading ? "..." : "Search"}
            </button>
          </div>

          {/* Results */}
          {searched && (
            <div className="space-y-3">
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No past bids found</p>
                  <p className="text-sm mt-1">Try different search terms</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {results.map((bid) => (
                    <div
                      key={bid.id}
                      className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-semibold text-gray-900">
                            RFQ #{bid.rfqNumber || bid.id}
                          </span>
                          {bid.agent.name && (
                            <span className="text-sm text-gray-500 ml-2">
                              Agent: {bid.agent.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          {new Date(bid.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {bid.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-3 border-t border-gray-100 first:border-0 first:pt-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                                NSN: ...{item.nsnLast4 || "????"}
                              </span>
                              <span className="text-gray-500">
                                Qty: {item.quantity} {item.unit}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="ml-3 flex-shrink-0">
                            {item.wasNoBid ? (
                              <span className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-sm">
                                <XCircle className="h-4 w-4" />
                                No Bid
                              </span>
                            ) : item.quotedUnitCost ? (
                              <button
                                onClick={() => handleApplyPrice(item)}
                                className="flex flex-col items-end gap-0.5 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors border border-green-200"
                              >
                                <div className="flex items-center gap-1 font-semibold">
                                  <DollarSign className="h-4 w-4" />
                                  <span className="text-lg">{item.quotedUnitCost}</span>
                                </div>
                                {item.quotedDeliveryDays && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.quotedDeliveryDays} days
                                  </span>
                                )}
                                <span className="text-xs text-green-600 font-medium">Click to use</span>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic px-3 py-1.5 bg-gray-50 rounded-lg">
                                No price quoted
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {!bid.hadResponse && (
                        <p className="text-xs text-amber-600 mt-3 pt-3 border-t border-gray-100 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          No quote was submitted for this RFQ
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
