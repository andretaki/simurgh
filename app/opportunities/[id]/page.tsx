"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Download,
  Mail,
  Phone,
  Calendar,
  Building,
  Package,
} from "lucide-react";

interface LineItem {
  lineNumber: string;
  description: string;
  quantity: number | null;
  unit: string;
  nsn: string;
  partNumber: string;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number | null;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  type: string;
}

interface OpportunityDetails {
  noticeId: string;
  solicitationNumber: string;
  title: string;
  description: string;
  fullDescription: string;
  postedDate: string;
  responseDeadline: string;
  archiveDate: string;
  naicsCode: string;
  psc: string;
  setAsideType: string | null;
  contractType: string;
  agency: string;
  office: string;
  location: string | null;
  contacts: Contact[];
  attachments: Attachment[];
  lineItems: LineItem[];
  award: { amount: number; awardee: string; awardDate: string } | null;
  uiLink: string;
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
  description: string | null;
  fullDescription: string | null;
  uiLink: string | null;
  relevanceScore: number;
  matchedKeyword: string | null;
  pocName: string | null;
  pocEmail: string | null;
  pocPhone: string | null;
  attachments: Attachment[] | null;
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [details, setDetails] = useState<OpportunityDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOpportunity() {
      try {
        const res = await fetch(`/api/opportunities/${id}`);
        const data = await res.json();

        if (data.success) {
          setOpportunity(data.data.opportunity);
          setDetails(data.data.details);
        } else {
          setError(data.error || "Failed to load opportunity");
        }
      } catch (err) {
        setError("Failed to load opportunity");
      } finally {
        setLoading(false);
      }
    }

    fetchOpportunity();
  }, [id]);

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Parse key details from the description wall of text
  function parseKeyDetails(desc: string | null | undefined): Record<string, string> {
    if (!desc) return {};
    const details: Record<string, string> = {};

    // Strip HTML
    const text = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Part Number - the key product identifier
    const pnMatch = text.match(/P\/N[:\s]*([A-Z0-9-]+)/i) ||
                    text.match(/part number[:\s]*([A-Z0-9-]+)/i) ||
                    text.match(/on part number ([A-Z0-9-]+)/i);
    if (pnMatch) details["Part #"] = pnMatch[1];

    // CAGE code - manufacturer identifier
    const cageMatch = text.match(/CAGE[:\s]*([A-Z0-9]{5})/i) ||
                      text.match(/cage\s+([A-Z0-9]{5})/i);
    if (cageMatch) details["CAGE"] = cageMatch[1];

    // Container/Package size (e.g., "5 gallons", "1 gallon cans")
    const containerMatch = text.match(/(\d+)\s*(gallon|gal|quart|qt|pint|pt|oz|ounce|lb|pound)s?\s*(cans?|drums?|containers?|bottles?|pails?)?/i) ||
                           text.match(/size of each (?:can|container|drum|pail) is (\d+)\s*(gallon|gal|quart|qt)/i);
    if (containerMatch) {
      const size = containerMatch[1];
      const unit = containerMatch[2].toUpperCase().replace('GALLON', 'GAL');
      const container = containerMatch[3] ? ` ${containerMatch[3]}` : '';
      details["Container"] = `${size} ${unit}${container}`;
    }

    // Shelf Life Code (e.g., "S UU", "Type II", shelf life code letter)
    const shelfCodeMatch = text.match(/shelf[- ]?life[^.]*?\(([A-Z]\s*[A-Z]{1,2})\)/i) ||
                           text.match(/requirement\s+\(([A-Z]\s*[A-Z]{1,2})\)/i);
    if (shelfCodeMatch) {
      const code = shelfCodeMatch[1].replace(/\s+/g, ' ').trim();
      // Decode common shelf life codes
      const shelfLifeMap: Record<string, string> = {
        'S': '60 months (5 yr)',
        'R': '48 months (4 yr)',
        'Q': '36 months (3 yr)',
        'M': '24 months (2 yr)',
        'H': '12 months (1 yr)',
      };
      const decoded = shelfLifeMap[code.charAt(0)] || '';
      details["Shelf Life"] = decoded ? `Code ${code} = ${decoded}` : `Code ${code}`;
    }

    // Delivery time
    const deliveryMatch = text.match(/DELIVERY\s+(\d+)\s*(DAYS?|WEEKS?|MONTHS?)/i) ||
                          text.match(/(\d+)\s*(DAYS?)\s+(?:AFTER|ARO|ADC)/i);
    if (deliveryMatch) details["Delivery"] = `${deliveryMatch[1]} ${deliveryMatch[2]}`;

    // Inspection type
    if (text.includes("GOVERNMENT SOURCE INSPECTION") || text.match(/GSI\s+(?:IS\s+)?REQUIRED/i)) {
      details["Inspection"] = "Government Source";
    } else if (text.includes("DESTINATION INSPECTION")) {
      details["Inspection"] = "Destination";
    } else if (text.includes("ORIGIN INSPECTION")) {
      details["Inspection"] = "Origin";
    }

    // FOB
    const fobMatch = text.match(/FOB[:\s-]*(DESTINATION|ORIGIN|SOURCE)/i);
    if (fobMatch) details["FOB"] = fobMatch[1];

    // Product spec - ONLY actual product specs, not marking/packaging standards
    // MIL-STD-130, MIL-STD-129, MIL-STD-2073 are just marking/packaging - skip those
    const milProductSpecs = text.match(/MIL-(?:G|PRF|L|H|C|DTL|A|O)-\d+[A-Z]?/gi);
    if (milProductSpecs) {
      const uniqueSpecs = [...new Set(milProductSpecs.map(s => s.toUpperCase()))];
      details["MIL Spec"] = uniqueSpecs.join(", ");
    }

    // Fed spec (product specs like O-G-760 for grease, A-A-59004 for chemicals)
    const fedSpecMatch = text.match(/(O-[A-Z]-\d+[A-Z]?)/i) ||
                         text.match(/(A-A-\d+[A-Z]?)/i) ||
                         text.match(/(VV-[A-Z]-\d+[A-Z]?)/i);  // VV specs for lubricants
    if (fedSpecMatch) details["Fed Spec"] = fedSpecMatch[1].toUpperCase();

    // SAE grade for oils
    const saeMatch = text.match(/SAE\s*(\d+W?-?\d*)/i);
    if (saeMatch) details["SAE Grade"] = `SAE ${saeMatch[1]}`;

    // Drawing number
    const drawingMatch = text.match(/(?:DRAWING|DWG)[:\s#]*(\d{5,}[-\d]*)/i) ||
                         text.match(/Drawing\s+(\d{5,}[-\d]*[-A-Z]*)/i);
    if (drawingMatch) details["Drawing"] = drawingMatch[1];

    // NSN - National Stock Number
    const nsnMatches = text.match(/\d{4}-\d{2}-\d{3}-\d{4}/g);
    if (nsnMatches) {
      const uniqueNsns = [...new Set(nsnMatches)];
      details["NSN"] = uniqueNsns.length > 1 ? `${uniqueNsns[0]} (+${uniqueNsns.length - 1})` : uniqueNsns[0];
    }

    // ASTM specs (actual material standards)
    const astmMatches = text.match(/ASTM[- ]?[A-Z]?\d+/gi);
    if (astmMatches) {
      const uniqueAstm = [...new Set(astmMatches.map(s => s.toUpperCase().replace(/\s+/g, '-')))];
      details["ASTM"] = uniqueAstm.join(", ");
    }

    // OD (Ordnance Document) - approved sources list
    const odMatch = text.match(/OD\s*(\d+)/i);
    if (odMatch) details["OD (Sources)"] = `OD${odMatch[1]}`;

    // Commercial/Brand description - look for "commercial brand name" indicator
    if (text.match(/commercial brand name/i)) {
      details["Type"] = "Commercial/Brand Name";
    }

    return details;
  }

  function getDaysUntil(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const deadline = new Date(dateStr);
    const now = new Date();
    const days = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading opportunity details...</div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">{error || "Not found"}</div>
        <div className="text-center mt-4">
          <Link href="/opportunities">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Opportunities
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const daysUntil = getDaysUntil(
    details?.responseDeadline || opportunity.responseDeadline
  );
  const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil > 0;
  const isExpired = daysUntil !== null && daysUntil <= 0;

  // Merge attachments from details and opportunity
  const attachments = details?.attachments || (opportunity.attachments as Attachment[]) || [];
  const lineItems = details?.lineItems || [];
  const contacts = details?.contacts || [];

  // Parse key details from description (prefer fullDescription which has the complete text)
  const keyDetails = parseKeyDetails(
    details?.fullDescription ||
    opportunity.fullDescription ||
    details?.description ||
    opportunity.description
  );

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/opportunities">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunities
          </Button>
        </Link>
      </div>

      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl">
                {opportunity.solicitationNumber}
              </CardTitle>
              <p className="text-lg text-muted-foreground mt-2">
                {details?.title || opportunity.title}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge
                className={
                  opportunity.relevanceScore >= 80
                    ? "bg-green-600"
                    : opportunity.relevanceScore >= 50
                    ? "bg-yellow-600"
                    : "bg-gray-600"
                }
              >
                Score: {opportunity.relevanceScore}
              </Badge>
              {opportunity.setAsideType &&
                opportunity.setAsideType !== "None" &&
                opportunity.setAsideType !== "NONE" && (
                  <Badge variant="secondary">{opportunity.setAsideType}</Badge>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Posted</div>
                <div>{formatDate(details?.postedDate || opportunity.postedDate)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar
                className={`h-4 w-4 ${
                  isExpired
                    ? "text-red-500"
                    : isUrgent
                    ? "text-yellow-500"
                    : "text-muted-foreground"
                }`}
              />
              <div>
                <div className="text-muted-foreground">Due</div>
                <div className={isExpired ? "text-red-500" : isUrgent ? "text-yellow-500 font-semibold" : ""}>
                  {formatDate(details?.responseDeadline || opportunity.responseDeadline)}
                  {daysUntil !== null && (
                    <span className="ml-1">
                      ({isExpired ? "EXPIRED" : `${daysUntil}d`})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">Agency</div>
                <div>{details?.agency || opportunity.agency || "N/A"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground">NAICS</div>
                <div>{details?.naicsCode || opportunity.naicsCode || "N/A"}</div>
              </div>
            </div>
          </div>

          {opportunity.uiLink && (
            <div className="mt-4 pt-4 border-t">
              <Button asChild>
                <a
                  href={opportunity.uiLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on SAM.gov
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Requirements - Parsed from description */}
      {Object.keys(keyDetails).length > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Key Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Most important: Part # and CAGE - what you're actually bidding on */}
              {keyDetails["Part #"] && (
                <div className="bg-white rounded p-2 border-2 border-blue-400">
                  <div className="text-xs text-muted-foreground">Part Number</div>
                  <div className="font-mono font-bold text-blue-700 text-lg">{keyDetails["Part #"]}</div>
                </div>
              )}
              {keyDetails["CAGE"] && (
                <div className="bg-white rounded p-2 border-2 border-blue-400">
                  <div className="text-xs text-muted-foreground">CAGE (Mfr)</div>
                  <div className="font-mono font-bold text-blue-700">{keyDetails["CAGE"]}</div>
                </div>
              )}
              {keyDetails["Container"] && (
                <div className="bg-white rounded p-2 border border-purple-200">
                  <div className="text-xs text-muted-foreground">Container Size</div>
                  <div className="font-semibold text-purple-700">{keyDetails["Container"]}</div>
                </div>
              )}
              {keyDetails["Type"] && (
                <div className="bg-white rounded p-2 border border-amber-200">
                  <div className="text-xs text-muted-foreground">Item Type</div>
                  <div className="font-semibold text-amber-700">{keyDetails["Type"]}</div>
                </div>
              )}
              {keyDetails["Drawing"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">Drawing #</div>
                  <div className="font-mono font-semibold">{keyDetails["Drawing"]}</div>
                </div>
              )}
              {keyDetails["MIL Spec"] && (
                <div className="bg-white rounded p-2 border border-green-200">
                  <div className="text-xs text-muted-foreground">MIL Spec</div>
                  <div className="font-semibold text-green-700">{keyDetails["MIL Spec"]}</div>
                </div>
              )}
              {keyDetails["Fed Spec"] && (
                <div className="bg-white rounded p-2 border border-green-200">
                  <div className="text-xs text-muted-foreground">Fed Spec</div>
                  <div className="font-semibold text-green-700">{keyDetails["Fed Spec"]}</div>
                </div>
              )}
              {keyDetails["ASTM"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">ASTM</div>
                  <div className="font-semibold">{keyDetails["ASTM"]}</div>
                </div>
              )}
              {keyDetails["SAE Grade"] && (
                <div className="bg-white rounded p-2 border border-amber-200">
                  <div className="text-xs text-muted-foreground">SAE Grade</div>
                  <div className="font-semibold text-amber-700">{keyDetails["SAE Grade"]}</div>
                </div>
              )}
              {keyDetails["NSN"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">NSN</div>
                  <div className="font-mono text-sm">{keyDetails["NSN"]}</div>
                </div>
              )}
              {keyDetails["Delivery"] && (
                <div className="bg-white rounded p-2 border border-orange-200">
                  <div className="text-xs text-muted-foreground">Delivery</div>
                  <div className="font-semibold text-orange-700">{keyDetails["Delivery"]}</div>
                </div>
              )}
              {keyDetails["Shelf Life"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">Shelf Life</div>
                  <div className="font-semibold">{keyDetails["Shelf Life"]}</div>
                </div>
              )}
              {keyDetails["OD (Sources)"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">Approved Sources</div>
                  <div className="font-mono">{keyDetails["OD (Sources)"]}</div>
                </div>
              )}
              {keyDetails["Inspection"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">Inspection</div>
                  <div className="font-semibold">{keyDetails["Inspection"]}</div>
                </div>
              )}
              {keyDetails["FOB"] && (
                <div className="bg-white rounded p-2 border">
                  <div className="text-xs text-muted-foreground">FOB</div>
                  <div className="font-semibold">{keyDetails["FOB"]}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {(details?.description || opportunity.description) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: details?.description || opportunity.description || ""
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {lineItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Line</th>
                    <th className="text-left py-2 pr-4">Description</th>
                    <th className="text-left py-2 pr-4">NSN</th>
                    <th className="text-right py-2 pr-4">Qty</th>
                    <th className="text-left py-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 pr-4">{item.lineNumber || idx + 1}</td>
                      <td className="py-2 pr-4">{item.description}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {item.nsn || "-"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {item.quantity || "-"}
                      </td>
                      <td className="py-2">{item.unit || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts */}
      {(contacts.length > 0 ||
        opportunity.pocName ||
        opportunity.pocEmail) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Point of Contact</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length > 0 ? (
              <div className="space-y-4">
                {contacts.map((contact, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="font-medium">{contact.name}</div>
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {opportunity.pocName && (
                  <div className="font-medium">{opportunity.pocName}</div>
                )}
                {opportunity.pocEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${opportunity.pocEmail}`}
                      className="text-blue-600 hover:underline"
                    >
                      {opportunity.pocEmail}
                    </a>
                  </div>
                )}
                {opportunity.pocPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${opportunity.pocPhone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {opportunity.pocPhone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{att.name}</span>
                  </div>
                  {att.url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Award Info */}
      {details?.award && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Award Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Awardee</div>
                <div className="font-medium">{details.award.awardee}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">
                  ${details.award.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div>{formatDate(details.award.awardDate)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
