import { Page } from '@playwright/test';

declare global {
  interface Window {
    performanceMetrics?: {
      startTime: number;
      entries: any[];
    };
  }
}

export class PerformanceMonitor {
  private metrics: any[] = [];

  constructor(private page: Page) {}

  async startMonitoring() {
    await this.page.context().newCDPSession(this.page);
    
    // Enable performance monitoring
    await this.page.context().addInitScript(() => {
      (window as any).performanceMetrics = {
        startTime: Date.now(),
        entries: []
      };

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).performanceMetrics.entries.push({
            name: entry.name,
            type: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
      });

      observer.observe({ entryTypes: ['navigation', 'resource', 'mark', 'measure', 'paint'] });
    });
  }

  async collectMetrics() {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');

      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive,
          responseTime: navigation.responseEnd - navigation.requestStart,
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart
        },
        paint: paint.map(p => ({
          name: p.name,
          startTime: p.startTime
        })),
        resources: {
          count: resources.length,
          totalSize: resources.reduce((acc, r: any) => acc + (r.transferSize || 0), 0),
          totalDuration: resources.reduce((acc, r: any) => acc + r.duration, 0)
        },
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null
      };
    });

    this.metrics.push({
      timestamp: Date.now(),
      url: this.page.url(),
      ...metrics
    });

    return metrics;
  }

  async measureAction<T>(name: string, action: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    
    await this.page.evaluate((markName) => {
      performance.mark(`${markName}-start`);
    }, name);

    const result = await action();

    await this.page.evaluate((markName) => {
      performance.mark(`${markName}-end`);
      performance.measure(markName, `${markName}-start`, `${markName}-end`);
    }, name);

    const duration = Date.now() - startTime;

    const measure = await this.page.evaluate((markName) => {
      const measures = performance.getEntriesByName(markName, 'measure');
      return measures[0] ? measures[0].duration : null;
    }, name);

    this.metrics.push({
      action: name,
      duration: measure || duration,
      timestamp: Date.now()
    });

    return { result, duration: measure || duration };
  }

  async checkCoreWebVitals() {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0;
        let fid = 0;
        let cls = 0;

        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            fid = (entries[0] as any).processingStart - entries[0].startTime;
          }
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });

        setTimeout(() => {
          resolve({
            LCP: lcp,
            FID: fid,
            CLS: cls,
            FCP: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
          });
        }, 5000);
      });
    });
  }

  async checkBundleSize() {
    const resources = await this.page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return resources.map(r => ({
        name: r.name,
        size: r.transferSize,
        duration: r.duration,
        type: r.initiatorType
      }));
    });

    const jsSize = resources
      .filter(r => r.name.endsWith('.js'))
      .reduce((acc, r) => acc + r.size, 0);

    const cssSize = resources
      .filter(r => r.name.endsWith('.css'))
      .reduce((acc, r) => acc + r.size, 0);

    const imageSize = resources
      .filter(r => ['img', 'image'].includes(r.type))
      .reduce((acc, r) => acc + r.size, 0);

    return {
      total: resources.reduce((acc, r) => acc + r.size, 0),
      js: jsSize,
      css: cssSize,
      images: imageSize,
      resourceCount: resources.length
    };
  }

  async generateReport() {
    const coreWebVitals = await this.checkCoreWebVitals();
    const bundleSize = await this.checkBundleSize();
    const latestMetrics = this.metrics[this.metrics.length - 1] || {};

    return {
      summary: {
        url: this.page.url(),
        timestamp: new Date().toISOString(),
        coreWebVitals,
        bundleSize,
        ...latestMetrics
      },
      details: this.metrics,
      recommendations: this.generateRecommendations(coreWebVitals, bundleSize)
    };
  }

  private generateRecommendations(webVitals: any, bundleSize: any) {
    const recommendations = [];

    if (webVitals.LCP > 2500) {
      recommendations.push('Optimize Largest Contentful Paint (LCP) - currently over 2.5s');
    }

    if (webVitals.FID > 100) {
      recommendations.push('Improve First Input Delay (FID) - currently over 100ms');
    }

    if (webVitals.CLS > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift (CLS) - currently over 0.1');
    }

    if (bundleSize.js > 500000) {
      recommendations.push('Consider code splitting - JS bundle size over 500KB');
    }

    if (bundleSize.total > 2000000) {
      recommendations.push('Total page size over 2MB - consider optimization');
    }

    return recommendations;
  }

  getMetrics() {
    return this.metrics;
  }

  clearMetrics() {
    this.metrics = [];
  }
}