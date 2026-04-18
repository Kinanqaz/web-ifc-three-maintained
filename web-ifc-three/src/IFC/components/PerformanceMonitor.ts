/**
 * PerformanceMonitor - Tracks performance metrics for web-ifc-three operations
 * Used to establish baselines and measure improvements from optimizations
 */

export interface PerformanceMetrics {
  timestamp: number;
  memory: {
    heapSize: number;
    heapUsed: number;
    geometryBuffers: number;
    textures: number;
    total: number;
  };
  loading: {
    parseTime: number;
    geometryProcessingTime: number;
    totalTime: number;
  };
  rendering: {
    fps: number;
    fpsMin: number;
    fpsMax: number;
    frameTimeAvg: number;
  };
  file: {
    ifcSize: number;
    compressedSize?: number;
  };
  gpu: {
    drawCalls: number;
    bufferSizes: number;
    textureMemory: number;
  };
}

export interface PerformanceSnapshot {
  name: string;
  metrics: PerformanceMetrics;
  duration?: number;
}

export class PerformanceMonitor {
  private snapshots: PerformanceSnapshot[] = [];
  private currentBenchmark: string | null = null;
  private benchmarkStartTime: number = 0;
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;

  constructor() {
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }

  /**
   * Start a new benchmark with the given name
   */
  startBenchmark(name: string): void {
    this.currentBenchmark = name;
    this.benchmarkStartTime = performance.now();
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
  }

  /**
   * End the current benchmark and capture metrics
   */
  endBenchmark(): PerformanceSnapshot | null {
    if (!this.currentBenchmark) return null;

    const duration = performance.now() - this.benchmarkStartTime;
    const metrics = this.captureMetrics();

    const snapshot: PerformanceSnapshot = {
      name: this.currentBenchmark,
      metrics,
      duration
    };

    this.snapshots.push(snapshot);
    this.currentBenchmark = null;

    return snapshot;
  }

  /**
   * Capture current performance metrics
   */
  captureMetrics(): PerformanceMetrics {
    const memory = this.captureMemoryMetrics();
    const gpu = this.captureGPUMetrics();

    return {
      timestamp: performance.now(),
      memory,
      loading: {
        parseTime: 0, // Will be set during parsing
        geometryProcessingTime: 0, // Will be set during parsing
        totalTime: 0 // Will be set during parsing
      },
      rendering: this.captureRenderingMetrics(),
      file: {
        ifcSize: 0 // Will be set when loading file
      },
      gpu
    };
  }

  /**
   * Capture memory metrics
   */
  private captureMemoryMetrics() {
    const memory = (performance as any).memory;
    if (!memory) {
      return {
        heapSize: 0,
        heapUsed: 0,
        geometryBuffers: 0,
        textures: 0,
        total: 0
      };
    }

    return {
      heapSize: memory.jsHeapSizeLimit || 0,
      heapUsed: memory.usedJSHeapSize || 0,
      geometryBuffers: 0, // Will be tracked externally
      textures: 0, // Will be tracked externally
      total: memory.usedJSHeapSize || 0
    };
  }

  /**
   * Capture rendering metrics (FPS)
   */
  private captureRenderingMetrics() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const fps = delta > 0 ? 1000 / delta : 0;
    this.frameTimes.push(fps);

    // Keep only last 60 frames (1 second at 60fps)
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    const avgFps = this.frameTimes.length > 0
      ? this.frameTimes.reduce((sum, f) => sum + f, 0) / this.frameTimes.length
      : 0;

    return {
      fps: avgFps,
      fpsMin: Math.min(...this.frameTimes),
      fpsMax: Math.max(...this.frameTimes),
      frameTimeAvg: avgFps > 0 ? 1000 / avgFps : 0
    };
  }

  /**
   * Capture GPU metrics (placeholder - will need Three.js context)
   */
  private captureGPUMetrics() {
    return {
      drawCalls: 0, // Will be tracked via Three.js renderer info
      bufferSizes: 0, // Will be tracked externally
      textureMemory: 0 // Will be tracked externally
    };
  }

  /**
   * Update loading metrics during parsing
   */
  updateLoadingMetrics(parseTime: number, geometryTime: number): void {
    if (!this.currentBenchmark) return;

    const snapshot = this.snapshots.find(s => s.name === this.currentBenchmark);
    if (snapshot) {
      snapshot.metrics.loading.parseTime = parseTime;
      snapshot.metrics.loading.geometryProcessingTime = geometryTime;
      snapshot.metrics.loading.totalTime = parseTime + geometryTime;
    }
  }

  /**
   * Update file size metric
   */
  updateFileSize(size: number, compressed?: number): void {
    if (!this.currentBenchmark) return;

    const snapshot = this.snapshots.find(s => s.name === this.currentBenchmark);
    if (snapshot) {
      snapshot.metrics.file.ifcSize = size;
      if (compressed !== undefined) {
        snapshot.metrics.file.compressedSize = compressed;
      }
    }
  }

  /**
   * Update memory metrics for specific categories
   */
  updateMemoryMetrics(geometryBuffers: number, textures: number): void {
    if (!this.currentBenchmark) return;

    const snapshot = this.snapshots.find(s => s.name === this.currentBenchmark);
    if (snapshot) {
      snapshot.metrics.memory.geometryBuffers = geometryBuffers;
      snapshot.metrics.memory.textures = textures;
      snapshot.metrics.memory.total = snapshot.metrics.memory.heapUsed + geometryBuffers + textures;
    }
  }

  /**
   * Update GPU metrics
   */
  updateGPUMetrics(drawCalls: number, bufferSizes: number, textureMemory: number): void {
    if (!this.currentBenchmark) return;

    const snapshot = this.snapshots.find(s => s.name === this.currentBenchmark);
    if (snapshot) {
      snapshot.metrics.gpu.drawCalls = drawCalls;
      snapshot.metrics.gpu.bufferSizes = bufferSizes;
      snapshot.metrics.gpu.textureMemory = textureMemory;
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get snapshot by name
   */
  getSnapshot(name: string): PerformanceSnapshot | undefined {
    return this.snapshots.find(s => s.name === name);
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(name1: string, name2: string): object {
    const snapshot1 = this.getSnapshot(name1);
    const snapshot2 = this.getSnapshot(name2);

    if (!snapshot1 || !snapshot2) {
      throw new Error(`One or both snapshots not found: ${name1}, ${name2}`);
    }

    const m1 = snapshot1.metrics;
    const m2 = snapshot2.metrics;

    return {
      memory: {
        heapUsed: this.formatDiff(m1.memory.heapUsed, m2.memory.heapUsed),
        geometryBuffers: this.formatDiff(m1.memory.geometryBuffers, m2.memory.geometryBuffers),
        textures: this.formatDiff(m1.memory.textures, m2.memory.textures),
        total: this.formatDiff(m1.memory.total, m2.memory.total)
      },
      loading: {
        parseTime: this.formatDiff(m1.loading.parseTime, m2.loading.parseTime),
        geometryProcessingTime: this.formatDiff(m1.loading.geometryProcessingTime, m2.loading.geometryProcessingTime),
        totalTime: this.formatDiff(m1.loading.totalTime, m2.loading.totalTime)
      },
      rendering: {
        fps: this.formatDiff(m1.rendering.fps, m2.rendering.fps),
        frameTimeAvg: this.formatDiff(m1.rendering.frameTimeAvg, m2.rendering.frameTimeAvg)
      },
      file: {
        ifcSize: this.formatDiff(m1.file.ifcSize, m2.file.ifcSize)
      },
      gpu: {
        drawCalls: this.formatDiff(m1.gpu.drawCalls, m2.gpu.drawCalls),
        bufferSizes: this.formatDiff(m1.gpu.bufferSizes, m2.gpu.bufferSizes),
        textureMemory: this.formatDiff(m1.gpu.textureMemory, m2.gpu.textureMemory)
      }
    };
  }

  /**
   * Format difference between two values
   */
  private formatDiff(value1: number, value2: number): object {
    const diff = value2 - value1;
    const percent = value1 !== 0 ? (diff / value1) * 100 : 0;

    return {
      before: value1,
      after: value2,
      diff,
      percent
    };
  }

  /**
   * Print report for a snapshot
   */
  printReport(name?: string): void {
    const snapshot = name ? this.getSnapshot(name) : this.snapshots[this.snapshots.length - 1];
    if (!snapshot) {
      console.log('No snapshot found');
      return;
    }

    console.log(`\n=== Performance Report: ${snapshot.name} ===`);
    console.log(`Duration: ${snapshot.duration?.toFixed(2)}ms`);
    console.log('\nMemory:');
    console.log(`  Heap Used: ${this.formatBytes(snapshot.metrics.memory.heapUsed)}`);
    console.log(`  Geometry Buffers: ${this.formatBytes(snapshot.metrics.memory.geometryBuffers)}`);
    console.log(`  Textures: ${this.formatBytes(snapshot.metrics.memory.textures)}`);
    console.log(`  Total: ${this.formatBytes(snapshot.metrics.memory.total)}`);
    console.log('\nLoading:');
    console.log(`  Parse Time: ${snapshot.metrics.loading.parseTime.toFixed(2)}ms`);
    console.log(`  Geometry Processing: ${snapshot.metrics.loading.geometryProcessingTime.toFixed(2)}ms`);
    console.log(`  Total: ${snapshot.metrics.loading.totalTime.toFixed(2)}ms`);
    console.log('\nRendering:');
    console.log(`  FPS: ${snapshot.metrics.rendering.fps.toFixed(2)}`);
    console.log(`  FPS Range: ${snapshot.metrics.rendering.fpsMin.toFixed(2)} - ${snapshot.metrics.rendering.fpsMax.toFixed(2)}`);
    console.log(`  Frame Time Avg: ${snapshot.metrics.rendering.frameTimeAvg.toFixed(2)}ms`);
    console.log('\nFile:');
    console.log(`  IFC Size: ${this.formatBytes(snapshot.metrics.file.ifcSize)}`);
    if (snapshot.metrics.file.compressedSize) {
      console.log(`  Compressed: ${this.formatBytes(snapshot.metrics.file.compressedSize)}`);
    }
    console.log('\nGPU:');
    console.log(`  Draw Calls: ${snapshot.metrics.gpu.drawCalls}`);
    console.log(`  Buffer Sizes: ${this.formatBytes(snapshot.metrics.gpu.bufferSizes)}`);
    console.log(`  Texture Memory: ${this.formatBytes(snapshot.metrics.gpu.textureMemory)}`);
  }

  /**
   * Export snapshot to JSON
   */
  exportReport(name?: string): string {
    const snapshot = name ? this.getSnapshot(name) : this.snapshots[this.snapshots.length - 1];
    if (!snapshot) {
      throw new Error('No snapshot found');
    }

    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Export all snapshots to JSON
   */
  exportAllReports(): string {
    return JSON.stringify(this.snapshots, null, 2);
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
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
