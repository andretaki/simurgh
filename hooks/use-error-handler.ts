import { useCallback, useState } from "react"
import { useToast } from "@/components/ui/use-toast"

export interface ErrorInfo {
  message: string
  code?: string
  details?: any
  timestamp: Date
  retry?: () => void
}

export function useErrorHandler() {
  const { toast } = useToast()
  const [errors, setErrors] = useState<ErrorInfo[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  const handleError = useCallback((
    error: unknown,
    context?: string,
    retry?: () => void | Promise<void>
  ) => {
    let errorInfo: ErrorInfo = {
      message: "An unexpected error occurred",
      timestamp: new Date(),
      retry,
    }

    if (error instanceof Error) {
      errorInfo.message = error.message
      errorInfo.details = error.stack
    } else if (typeof error === "string") {
      errorInfo.message = error
    } else if (error && typeof error === "object") {
      if ("message" in error) {
        errorInfo.message = String(error.message)
      }
      if ("code" in error) {
        errorInfo.code = String(error.code)
      }
      errorInfo.details = error
    }

    // Add context if provided
    if (context) {
      errorInfo.message = `${context}: ${errorInfo.message}`
    }

    // Log error in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught:", errorInfo)
    }

    // Add to error history
    setErrors(prev => [...prev, errorInfo])

    // Show toast notification
    toast({
      variant: "destructive",
      title: "Error",
      description: errorInfo.message,
    })

    return errorInfo
  }, [toast])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  const retryLastError = useCallback(async () => {
    const lastError = errors[errors.length - 1]
    if (lastError?.retry) {
      setIsRetrying(true)
      try {
        await lastError.retry()
        // Remove the error if retry succeeds
        setErrors(prev => prev.slice(0, -1))
      } catch (error) {
        handleError(error, "Retry failed")
      } finally {
        setIsRetrying(false)
      }
    }
  }, [errors, handleError])

  return {
    handleError,
    errors,
    clearErrors,
    retryLastError,
    isRetrying,
    hasErrors: errors.length > 0,
  }
}

// Network error handler
export function handleNetworkError(error: unknown): string {
  if (!window.navigator.onLine) {
    return "No internet connection. Please check your network."
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "Network request failed. Please try again."
  }

  if (error && typeof error === "object" && "status" in error) {
    const status = Number(error.status)
    switch (status) {
      case 400:
        return "Invalid request. Please check your input."
      case 401:
        return "Authentication required. Please log in."
      case 403:
        return "Permission denied."
      case 404:
        return "Resource not found."
      case 429:
        return "Too many requests. Please try again later."
      case 500:
        return "Server error. Please try again later."
      case 502:
      case 503:
      case 504:
        return "Service temporarily unavailable. Please try again later."
      default:
        return `Request failed with status ${status}`
    }
  }

  return "An unexpected network error occurred"
}

// API error handler
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`
    
    try {
      const errorData = await response.json()
      if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // If JSON parsing fails, use the default message
    }

    throw new Error(errorMessage)
  }

  return response.json()
}