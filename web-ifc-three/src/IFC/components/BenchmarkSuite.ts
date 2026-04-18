/**
 * BenchmarkSuite - Provides test scenarios for performance testing
 * Used to establish baselines and compare performance across optimization steps
 */

import { PerformanceMonitor, PerformanceMetrics } from './PerformanceMonitor';

export interface BenchmarkScenario {
  name: string;
  description: string;
  ifcPath: string;
  expectedSize?: {
    min: number;
    max: number;
  };
}

export interface BenchmarkResult {
  scenario: string;
  snapshot: PerformanceSnapshot;
  passed: boolean;
  notes: string[];
}

export interface PerformanceSnapshot {
  name: string;
  metrics: PerformanceMetrics;
  duration?: number;
}

export class BenchmarkSuite {
  private monitor: PerformanceMonitor;
  private scenarios: BenchmarkScenario[] = [];
  private results: BenchmarkResult[] = [];
  private benchmarkStartTime: number = 0;

  constructor(monitor?: PerformanceMonitor) {
    this.monitor = monitor || new PerformanceMonitor();
  }

  /**
   * Add a benchmark scenario
   */
  addScenario(scenario: BenchmarkScenario): void {
    this.scenarios.push(scenario);
  }

  /**
   * Get all scenarios
   */
  getScenarios(): BenchmarkScenario[] {
    return [...this.scenarios];
  }

  /**
   * Run a specific benchmark scenario
   */
  async runScenario(
    scenarioName: string,
    loadFunction: (buffer: ArrayBuffer) => Promise<any>
  ): Promise<BenchmarkResult> {
    const scenario = this.scenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioName}`);
    }

    const notes: string[] = [];
    let passed = true;
    this.benchmarkStartTime = performance.now();

    try {
      this.monitor.startBenchmark(scenarioName);

      // Load the IFC file
      const response = await fetch(scenario.ifcPath);
      if (!response.ok) {
        throw new Error(`Failed to load IFC file: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fileSize = buffer.byteLength;
      this.monitor.updateFileSize(fileSize);

      // Check file size is within expected range
      if (scenario.expectedSize) {
        if (fileSize < scenario.expectedSize.min || fileSize > scenario.expectedSize.max) {
          notes.push(
            `File size ${fileSize} bytes is outside expected range ${scenario.expectedSize.min}-${scenario.expectedSize.max}`
          );
          passed = false;
        }
      }

      // Run the load function
      const startTime = performance.now();
      const result = await loadFunction(buffer);
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      this.monitor.updateLoadingMetrics(loadTime, 0); // Geometry time will be updated separately

      notes.push(`Load time: ${loadTime.toFixed(2)}ms`);
      notes.push(`File size: ${this.formatBytes(fileSize)}`);

      const snapshot = this.monitor.endBenchmark();
      if (!snapshot) {
        throw new Error('Failed to capture snapshot');
      }

      const benchmarkResult: BenchmarkResult = {
        scenario: scenarioName,
        snapshot,
        passed,
        notes
      };

      this.results.push(benchmarkResult);
      return benchmarkResult;

    } catch (error) {
      notes.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
      passed = false;

      const snapshot: PerformanceSnapshot = {
        name: scenarioName,
        metrics: this.monitor.captureMetrics(),
        duration: performance.now() - this.benchmarkStartTime
      };

      const benchmarkResult: BenchmarkResult = {
        scenario: scenarioName,
        snapshot,
        passed,
        notes
      };

      this.results.push(benchmarkResult);
      return benchmarkResult;
    }
  }

  /**
   * Run all benchmark scenarios
   */
  async runAllScenarios(
    loadFunction: (buffer: ArrayBuffer) => Promise<any>
  ): Promise<BenchmarkResult[]> {
    this.results = [];

    for (const scenario of this.scenarios) {
      console.log(`\nRunning benchmark: ${scenario.name}`);
      const result = await this.runScenario(scenario.name, loadFunction);
      console.log(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
      result.notes.forEach(note => console.log(`  - ${note}`));
    }

    return this.results;
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get result by scenario name
   */
  getResult(scenarioName: string): BenchmarkResult | undefined {
    return this.results.find(r => r.scenario === scenarioName);
  }

  /**
   * Generate comparison report between two benchmark runs
   */
  generateComparisonReport(scenarioName: string, result1: BenchmarkResult, result2: BenchmarkResult): string {
    const m1 = result1.snapshot.metrics;
    const m2 = result2.snapshot.metrics;

    let report = `\n=== Comparison Report: ${scenarioName} ===\n`;
    report += `Run 1: ${new Date(result1.snapshot.metrics.timestamp).toISOString()}\n`;
    report += `Run 2: ${new Date(result2.snapshot.metrics.timestamp).toISOString()}\n\n`;

    report += 'Memory:\n';
    report += `  Heap Used: ${this.formatChange(m1.memory.heapUsed, m2.memory.heapUsed)}\n`;
    report += `  Geometry Buffers: ${this.formatChange(m1.memory.geometryBuffers, m2.memory.geometryBuffers)}\n`;
    report += `  Textures: ${this.formatChange(m1.memory.textures, m2.memory.textures)}\n`;
    report += `  Total: ${this.formatChange(m1.memory.total, m2.memory.total)}\n`;

    report += '\nLoading:\n';
    report += `  Parse Time: ${this.formatChange(m1.loading.parseTime, m2.loading.parseTime)}\n`;
    report += `  Total Time: ${this.formatChange(m1.loading.totalTime, m2.loading.totalTime)}\n`;

    report += '\nRendering:\n';
    report += `  FPS: ${this.formatChange(m1.rendering.fps, m2.rendering.fps)}\n`;
    report += `  Frame Time: ${this.formatChange(m1.rendering.frameTimeAvg, m2.rendering.frameTimeAvg)}\n`;

    report += '\nGPU:\n';
    report += `  Draw Calls: ${this.formatChange(m1.gpu.drawCalls, m2.gpu.drawCalls)}\n`;
    report += `  Texture Memory: ${this.formatChange(m1.gpu.textureMemory, m2.gpu.textureMemory)}\n`;

    return report;
  }

  /**
   * Print all results
   */
  printResults(): void {
    console.log('\n=== Benchmark Results ===');
    this.results.forEach(result => {
      console.log(`\n${result.scenario}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      result.notes.forEach(note => console.log(`  - ${note}`));
    });
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Get the underlying PerformanceMonitor
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }

  /**
   * Format change between two values
   */
  private formatChange(value1: number, value2: number): string {
    const diff = value2 - value1;
    const percent = value1 !== 0 ? ((diff / value1) * 100).toFixed(2) : '0.00';
    const sign = diff >= 0 ? '+' : '';
    return `${this.formatBytes(value1)} → ${this.formatBytes(value2)} (${sign}${percent}%)`;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Predefined benchmark scenarios for common model sizes
 */
export const PREDEFINED_SCENARIOS: BenchmarkScenario[] = [
  {
    name: 'small-model',
    description: 'Small IFC model (<50MB)',
    ifcPath: '/path/to/small.ifc',
    expectedSize: { min: 0, max: 50 * 1024 * 1024 }
  },
  {
    name: 'medium-model',
    description: 'Medium IFC model (50-200MB)',
    ifcPath: '/path/to/medium.ifc',
    expectedSize: { min: 50 * 1024 * 1024, max: 200 * 1024 * 1024 }
  },
  {
    name: 'large-model',
    description: 'Large IFC model (>200MB)',
    ifcPath: '/path/to/large.ifc',
    expectedSize: { min: 200 * 1024 * 1024, max: Number.MAX_VALUE }
  }
];
