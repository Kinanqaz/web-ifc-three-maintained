/**
 * Performance Monitor Test Utility
 * 
 * This file demonstrates how to use the PerformanceMonitor to establish a baseline
 * for web-ifc-three performance. This can be run in the browser console or integrated
 * into the Navio app for automated testing.
 */

import { PerformanceMonitor, BenchmarkSuite } from './index';
import { IFCManager } from './IFCManager';

/**
 * Test the PerformanceMonitor with the Demo.ifc file
 * This establishes a baseline for all future optimizations
 */
export async function testPerformanceMonitor() {
  const monitor = new PerformanceMonitor();
  const ifcManager = new IFCManager();

  try {
    // Start benchmark
    monitor.startBenchmark('baseline');
    console.log('Starting baseline performance test...');

    // Load the IFC file
    const response = await fetch('/Demo.ifc');
    if (!response.ok) {
      throw new Error(`Failed to load Demo.ifc: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fileSize = buffer.byteLength;
    monitor.updateFileSize(fileSize);
    console.log(`Loaded Demo.ifc: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Parse the IFC file
    const parseStartTime = performance.now();
    const model = await ifcManager.parse(buffer);
    const parseTime = performance.now() - parseStartTime;

    monitor.updateLoadingMetrics(parseTime, 0); // Geometry time tracked separately
    console.log(`Parse time: ${parseTime.toFixed(2)}ms`);

    // Estimate geometry memory usage
    const geometryMemory = estimateGeometryMemory(model);
    monitor.updateMemoryMetrics(geometryMemory, 0); // Texture memory tracked separately
    console.log(`Estimated geometry memory: ${(geometryMemory / 1024 / 1024).toFixed(2)} MB`);

    // End benchmark
    const snapshot = monitor.endBenchmark();
    if (!snapshot) {
      throw new Error('Failed to capture snapshot');
    }

    // Print report
    monitor.printReport();

    // Export report
    const report = monitor.exportReport();
    console.log('\n=== JSON Report ===');
    console.log(report);

    // Save to localStorage for comparison later
    localStorage.setItem('baseline-report', report);
    console.log('\nBaseline report saved to localStorage as "baseline-report"');

    // Close the model
    ifcManager.close(model.modelID);

    return snapshot;

  } catch (error) {
    console.error('Performance test failed:', error);
    throw error;
  }
}

/**
 * Estimate geometry memory usage from an IFC model
 */
function estimateGeometryMemory(model: any): number {
  try {
    // This is a rough estimate - actual memory usage would need more detailed inspection
    if (model && model.mesh) {
      const geometry = model.mesh.geometry;
      if (geometry) {
        let total = 0;
        
        // Count vertex attributes
        const attributes = geometry.attributes;
        for (const key in attributes) {
          const attr = attributes[key];
          total += attr.array.byteLength;
        }
        
        // Count index buffer
        if (geometry.index) {
          total += geometry.index.array.byteLength;
        }
        
        return total;
      }
    }
  } catch (error) {
    console.warn('Failed to estimate geometry memory:', error);
  }
  
  return 0;
}

/**
 * Compare current performance with saved baseline
 */
export function compareWithBaseline(): void {
  const baseline = localStorage.getItem('baseline-report');
  if (!baseline) {
    console.log('No baseline report found. Run testPerformanceMonitor() first.');
    return;
  }

  const monitor = new PerformanceMonitor();
  monitor.startBenchmark('current');
  
  // Capture current metrics (without loading a new file)
  const currentSnapshot = monitor.captureMetrics();
  const current = {
    name: 'current',
    metrics: currentSnapshot,
    duration: 0
  };
  
  const baselineData = JSON.parse(baseline);
  
  console.log('\n=== Performance Comparison ===');
  console.log('Baseline:', new Date(baselineData.metrics.timestamp).toISOString());
  console.log('Current:', new Date(currentSnapshot.timestamp).toISOString());
  
  const m1 = baselineData.metrics;
  const m2 = currentSnapshot;
  
  console.log('\nMemory:');
  console.log(`  Heap Used: ${formatDiff(m1.memory.heapUsed, m2.memory.heapUsed)}`);
  console.log(`  Total: ${formatDiff(m1.memory.total, m2.memory.total)}`);
  
  console.log('\nRendering:');
  console.log(`  FPS: ${formatDiff(m1.rendering.fps, m2.rendering.fps)}`);
}

/**
 * Format difference between two values
 */
function formatDiff(value1: number, value2: number): string {
  const diff = value2 - value1;
  const percent = value1 !== 0 ? ((diff / value1) * 100).toFixed(2) : '0.00';
  const sign = diff >= 0 ? '+' : '';
  return `${formatBytes(value1)} → ${formatBytes(value2)} (${sign}${percent}%)`;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Run a complete benchmark suite
 */
export async function runBenchmarkSuite() {
  const monitor = new PerformanceMonitor();
  const suite = new BenchmarkSuite(monitor);
  
  // Add Demo.ifc as a test scenario
  suite.addScenario({
    name: 'demo-ifc',
    description: 'Demo IFC file for baseline testing',
    ifcPath: '/Demo.ifc',
    expectedSize: {
      min: 2 * 1024 * 1024,  // 2 MB
      max: 3 * 1024 * 1024   // 3 MB
    }
  });
  
  // Define the load function
  const loadFunction = async (buffer: ArrayBuffer) => {
    const ifcManager = new IFCManager();
    const model = await ifcManager.parse(buffer);
    
    // Estimate memory
    const geometryMemory = estimateGeometryMemory(model);
    monitor.updateMemoryMetrics(geometryMemory, 0);
    
    return model;
  };
  
  // Run the benchmark
  console.log('Running benchmark suite...');
  const results = await suite.runAllScenarios(loadFunction);
  
  // Print results
  suite.printResults();
  
  // Export results
  const resultsJson = suite.exportResults();
  console.log('\n=== Benchmark Results JSON ===');
  console.log(resultsJson);
  
  // Save to localStorage
  localStorage.setItem('benchmark-results', resultsJson);
  console.log('\nBenchmark results saved to localStorage as "benchmark-results"');
  
  return results;
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testPerformanceMonitor = testPerformanceMonitor;
  (window as any).compareWithBaseline = compareWithBaseline;
  (window as any).runBenchmarkSuite = runBenchmarkSuite;
  console.log('Performance Monitor test functions available:');
  console.log('  - testPerformanceMonitor()');
  console.log('  - compareWithBaseline()');
  console.log('  - runBenchmarkSuite()');
}
