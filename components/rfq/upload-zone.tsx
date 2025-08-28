"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface FileUploadStatus {
  file: File
  id: string
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  errorMessage?: string
  s3Key?: string
}

interface UploadZoneProps {
  onUploadComplete?: (files: FileUploadStatus[]) => void
  maxFiles?: number
  accept?: Record<string, string[]>
}

export function UploadZone({ 
  onUploadComplete, 
  maxFiles = 10,
  accept = { "application/pdf": [".pdf"] }
}: UploadZoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const uploadFile = async (fileStatus: FileUploadStatus) => {
    const formData = new FormData()
    formData.append("file", fileStatus.file)

    try {
      // Update status to uploading
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileStatus.id 
          ? { ...f, status: "uploading" as const, progress: 10 }
          : f
        )
      )

      const response = await fetch("/api/rfq/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const data = await response.json()

      // Update status to success
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileStatus.id 
          ? { ...f, status: "success" as const, progress: 100, s3Key: data.s3Key }
          : f
        )
      )
    } catch (error) {
      // Update status to error
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileStatus.id 
          ? { 
              ...f, 
              status: "error" as const, 
              progress: 0, 
              errorMessage: error instanceof Error ? error.message : "Upload failed" 
            }
          : f
        )
      )
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: FileUploadStatus[] = acceptedFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      progress: 0,
      status: "pending" as const,
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])
    setIsUploading(true)

    // Upload files sequentially
    for (const fileStatus of newFiles) {
      await uploadFile(fileStatus)
    }

    setIsUploading(false)

    if (onUploadComplete) {
      onUploadComplete(uploadedFiles)
    }
  }, [uploadedFiles, onUploadComplete])

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled: isUploading,
  })

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium">
              Drag & drop RFQ documents here
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              or click to select files (PDF only)
            </p>
          </>
        )}
      </Card>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Files</h3>
          {uploadedFiles.map(fileStatus => (
            <Card key={fileStatus.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileStatus.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {fileStatus.status === "pending" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {fileStatus.status === "uploading" && (
                    <Badge variant="info">Uploading</Badge>
                  )}
                  {fileStatus.status === "success" && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {fileStatus.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileStatus.id)}
                    disabled={fileStatus.status === "uploading"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {fileStatus.status === "uploading" && (
                <Progress value={fileStatus.progress} className="mt-2" />
              )}
              
              {fileStatus.status === "error" && fileStatus.errorMessage && (
                <p className="text-xs text-destructive mt-2">
                  {fileStatus.errorMessage}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}