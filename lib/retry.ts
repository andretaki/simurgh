interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoff?: "linear" | "exponential"
  onRetry?: (attempt: number, error: Error) => void
  shouldRetry?: (error: Error) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delay: 1000,
  backoff: "exponential",
  onRetry: () => {},
  shouldRetry: () => true,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if we should retry
      if (!opts.shouldRetry(lastError)) {
        throw lastError
      }
      
      // Don't retry if this was the last attempt
      if (attempt === opts.maxAttempts) {
        throw lastError
      }
      
      // Call retry callback
      opts.onRetry(attempt, lastError)
      
      // Calculate delay
      const delay = opts.backoff === "exponential" 
        ? opts.delay * Math.pow(2, attempt - 1)
        : opts.delay * attempt
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error("Retry failed")
}

// Retry decorator for class methods
export function Retry(options?: RetryOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options
      )
    }
    
    return descriptor
  }
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime?: number
  private state: "closed" | "open" | "half-open" = "closed"
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === "open" &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime > this.timeout
    ) {
      this.state = "half-open"
    }
    
    // If circuit is open, reject immediately
    if (this.state === "open") {
      throw new Error("Circuit breaker is open - service unavailable")
    }
    
    try {
      const result = await fn()
      
      // Reset on success
      if (this.state === "half-open") {
        this.reset()
      }
      
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }
  
  private recordFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.threshold) {
      this.state = "open"
      console.warn(`Circuit breaker opened after ${this.failures} failures`)
    }
  }
  
  private reset() {
    this.failures = 0
    this.lastFailureTime = undefined
    this.state = "closed"
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

// Rate limiter
export class RateLimiter {
  private queue: Array<() => void> = []
  private running = 0
  
  constructor(
    private readonly maxConcurrent: number = 5,
    private readonly perInterval: number = 10,
    private readonly interval: number = 1000
  ) {
    setInterval(() => {
      this.processQueue()
    }, this.interval)
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
        }
      })
      
      this.processQueue()
    })
  }
  
  private processQueue() {
    while (
      this.queue.length > 0 &&
      this.running < this.maxConcurrent
    ) {
      const fn = this.queue.shift()
      if (fn) fn()
    }
  }
}