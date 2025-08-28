import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Calendar, Building, Download, Eye, Clock } from "lucide-react"
import Link from "next/link"

interface RFQCardProps {
  rfq: {
    id: string
    fileName: string
    rfqNumber?: string | null
    status: string
    createdAt: Date
    updatedAt: Date
    dueDate?: Date | null
    contractingOffice?: string | null
    extractedFields?: any
    s3Key: string
  }
}

export function RFQCard({ rfq }: RFQCardProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "processed":
        return "success"
      case "processing":
        return "info"
      case "failed":
        return "destructive"
      case "filled":
        return "default"
      default:
        return "secondary"
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-sm">
                {rfq.rfqNumber || rfq.fileName}
              </h3>
              {rfq.extractedFields?.title && (
                <p className="text-xs text-muted-foreground mt-1">
                  {rfq.extractedFields.title}
                </p>
              )}
            </div>
          </div>
          <Badge variant={getStatusVariant(rfq.status) as any}>
            {rfq.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {rfq.contractingOffice && (
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Building className="h-3 w-3" />
              <span className="truncate">{rfq.contractingOffice}</span>
            </div>
          )}
          
          {rfq.dueDate && (
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due: {new Date(rfq.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(rfq.createdAt)}</span>
          </div>
        </div>

        {rfq.extractedFields?.emailSource && (
          <div className="text-xs text-muted-foreground">
            From: {rfq.extractedFields.emailSource}
          </div>
        )}

        <div className="flex space-x-2 pt-2">
          <Link href={`/rfq/${rfq.id}/fill`} className="flex-1">
            <Button variant="default" size="sm" className="w-full">
              <Eye className="mr-1 h-3 w-3" />
              View & Fill
            </Button>
          </Link>
          
          <Link href={`/api/rfq/${rfq.id}/download`}>
            <Button variant="outline" size="sm">
              <Download className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}