"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  User,
  Building,
  FileText,
  DollarSign,
  Truck,
  Shield,
  Loader2,
} from "lucide-react"

interface FieldMapping {
  field: string
  value: any
  source: "profile" | "ai" | "default"
  confidence?: number
  category: string
}

interface AutoFillModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mappings: FieldMapping[]) => void
  rfqSummary?: string
  companyProfile?: any
}

export function AutoFillModal({
  isOpen,
  onClose,
  onConfirm,
  rfqSummary,
  companyProfile,
}: AutoFillModalProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isOpen && companyProfile) {
      analyzeMappings()
    }
  }, [isOpen, companyProfile])

  const analyzeMappings = async () => {
    setIsAnalyzing(true)
    setProgress(0)
    
    // Simulate progressive loading
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 200)

    try {
      // Get AI suggestions if RFQ summary is available
      if (rfqSummary) {
        const response = await fetch("/api/rfq/analyze-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            rfqSummary,
            companyProfile 
          }),
        })
        
        if (response.ok) {
          const suggestions = await response.json()
          setAiSuggestions(suggestions)
        }
      }

      // Create field mappings
      const newMappings: FieldMapping[] = []
      
      // Company Information
      if (companyProfile.companyName) {
        newMappings.push({
          field: "Company Name",
          value: companyProfile.companyName,
          source: "profile",
          category: "Company Info",
          confidence: 100,
        })
      }
      
      if (companyProfile.cageCode) {
        newMappings.push({
          field: "CAGE Code",
          value: companyProfile.cageCode,
          source: "profile",
          category: "Company Info",
          confidence: 100,
        })
      }
      
      if (companyProfile.samUei) {
        newMappings.push({
          field: "SAM UEI",
          value: companyProfile.samUei,
          source: "profile",
          category: "Company Info",
          confidence: 100,
        })
      }
      
      if (companyProfile.naicsCode) {
        newMappings.push({
          field: "NAICS Code",
          value: companyProfile.naicsCode,
          source: "profile",
          category: "Company Info",
          confidence: 100,
        })
      }

      // Contact Information
      if (companyProfile.contactPerson) {
        newMappings.push({
          field: "Contact Person",
          value: companyProfile.contactPerson,
          source: "profile",
          category: "Contact",
          confidence: 100,
        })
      }
      
      if (companyProfile.contactEmail) {
        newMappings.push({
          field: "Contact Email",
          value: companyProfile.contactEmail,
          source: "profile",
          category: "Contact",
          confidence: 100,
        })
      }
      
      if (companyProfile.contactPhone) {
        newMappings.push({
          field: "Contact Phone",
          value: companyProfile.contactPhone,
          source: "profile",
          category: "Contact",
          confidence: 100,
        })
      }

      // Payment & Terms
      if (companyProfile.defaultPaymentTerms) {
        newMappings.push({
          field: "Payment Terms",
          value: companyProfile.defaultPaymentTerms,
          source: "profile",
          category: "Payment",
          confidence: 100,
        })
      }
      
      if (companyProfile.defaultFob) {
        newMappings.push({
          field: "FOB",
          value: companyProfile.defaultFob,
          source: "profile",
          category: "Shipping",
          confidence: 100,
        })
      }

      // Business Classifications
      const classifications = []
      if (companyProfile.smallDisadvantaged) classifications.push("Small Disadvantaged")
      if (companyProfile.womanOwned) classifications.push("Woman-Owned")
      if (companyProfile.veteranOwned) classifications.push("Veteran-Owned")
      if (companyProfile.serviceDisabledVetOwned) classifications.push("Service-Disabled Veteran-Owned")
      if (companyProfile.hubZone) classifications.push("HUBZone")
      
      if (classifications.length > 0) {
        newMappings.push({
          field: "Business Classifications",
          value: classifications.join(", "),
          source: "profile",
          category: "Classifications",
          confidence: 100,
        })
      }

      // AI-suggested fields
      if (aiSuggestions?.suggestedValues) {
        Object.entries(aiSuggestions.suggestedValues).forEach(([field, value]) => {
          if (!newMappings.some(m => m.field === field)) {
            newMappings.push({
              field,
              value,
              source: "ai",
              category: "AI Suggested",
              confidence: aiSuggestions.confidence?.[field] || 75,
            })
          }
        })
      }

      // Default values
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      
      newMappings.push({
        field: "Price Firm Until",
        value: thirtyDaysFromNow.toISOString().split("T")[0],
        source: "default",
        category: "Quote Details",
        confidence: 100,
      })
      
      newMappings.push({
        field: "Quote Reference",
        value: `QTE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        source: "default",
        category: "Quote Details",
        confidence: 100,
      })

      setMappings(newMappings)
      clearInterval(progressInterval)
      setProgress(100)
    } catch (error) {
      console.error("Error analyzing mappings:", error)
      clearInterval(progressInterval)
      setProgress(0)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Company Info":
        return <Building className="w-4 h-4" />
      case "Contact":
        return <User className="w-4 h-4" />
      case "Payment":
        return <DollarSign className="w-4 h-4" />
      case "Shipping":
        return <Truck className="w-4 h-4" />
      case "Classifications":
        return <Shield className="w-4 h-4" />
      case "Quote Details":
        return <FileText className="w-4 h-4" />
      case "AI Suggested":
        return <Sparkles className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getSourceBadge = (source: string, confidence?: number) => {
    switch (source) {
      case "profile":
        return (
          <Badge variant="success" className="text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Profile
          </Badge>
        )
      case "ai":
        return (
          <Badge variant="info" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            AI {confidence && `(${confidence}%)`}
          </Badge>
        )
      case "default":
        return (
          <Badge variant="secondary" className="text-xs">
            Default
          </Badge>
        )
      default:
        return null
    }
  }

  const groupedMappings = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.category]) {
      acc[mapping.category] = []
    }
    acc[mapping.category].push(mapping)
    return acc
  }, {} as Record<string, FieldMapping[]>)

  const handleConfirm = () => {
    onConfirm(mappings)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Auto-Fill RFQ Fields
          </DialogTitle>
          <DialogDescription>
            Review the fields that will be automatically filled from your company profile
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="space-y-4 py-8">
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-muted-foreground">Analyzing RFQ requirements...</p>
            </div>
            <Progress value={progress} className="w-full" />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-3/4" />
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedMappings).map(([category, fields]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      {getCategoryIcon(category)}
                      <span>{category}</span>
                      <Badge variant="outline" className="ml-auto">
                        {fields.length} fields
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {fields.map((mapping, idx) => (
                        <div
                          key={`${category}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{mapping.field}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-md">
                              {mapping.value}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getSourceBadge(mapping.source, mapping.confidence)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {aiSuggestions?.warning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {aiSuggestions.warning}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{mappings.length} fields will be auto-filled</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {mappings.filter(m => m.source === "profile").length} from profile
                {aiSuggestions && (
                  <>
                    <span className="mx-1">•</span>
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    {mappings.filter(m => m.source === "ai").length} AI suggested
                  </>
                )}
              </span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isAnalyzing || mappings.length === 0}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Apply Auto-Fill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}