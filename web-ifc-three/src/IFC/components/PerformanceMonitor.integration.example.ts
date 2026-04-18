/**
 * Performance Monitor Integration Example
 * 
 * This file shows how to integrate the PerformanceMonitor into the Navio app
 * to track performance metrics during IFC loading and rendering.
 */

import { PerformanceMonitor } from './PerformanceMonitor';
import { IFCManager } from './IFCManager';

/**
 * Example: Integrating PerformanceMonitor into IFCViewer component
 * 
 * This shows how to wrap the existing IFC loading logic with performance monitoring.
 */

export class IFCViewerWithMonitoring {
  private ifcManager: IFCManager;
  private monitor: PerformanceMonitor;
  private currentModel: any = null;

  constructor() {
    this.ifcManager = new IFCManager();
    this.monitor = new PerformanceMonitor();
  }

  /**
   * Load an IFC file with performance monitoring
   */
  async loadIFC(url: string, onProgress?: (progress: number) => void) {
    try {
      // Start monitoring
      this.monitor.startBenchmark('ifc-load');
      console.log('Starting IFC load with performance monitoring...');

      // Load file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load IFC file: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fileSize = buffer.byteLength;
      this.monitor.updateFileSize(fileSize);
      
      if (onProgress) onProgress(10);

      // Parse IFC
      const parseStartTime = performance.now();
      this.currentModel = await this.ifcManager.parse(buffer);
      const parseTime = performance.now() - parseStartTime;
      
      this.monitor.updateLoadingMetrics(parseTime, 0);
      
      if (onProgress) onProgress(50);

      // Estimate memory usage
      const geometryMemory = this.estimateGeometryMemory(this.currentModel);
      this.monitor.updateMemoryMetrics(geometryMemory, 0);
      
      if (onProgress) onProgress(100);

      // End monitoring and print report
      const snapshot = this.monitor.endBenchmark();
      if (snapshot) {
        console.log('=== IFC Load Performance ===');
        console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Parse time: ${parseTime.toFixed(2)}ms`);
        console.log(`Memory used: ${(geometryMemory / 1024 / 1024).toFixed(2)} MB`);
        
        // Save report for comparison
        const report = this.monitor.exportReport();
        localStorage.setItem(`ifc-load-${Date.now()}`, report);
      }

      return this.currentModel;

    } catch (error) {
      console.error('IFC load failed:', error);
      throw error;
    }
  }

  /**
   * Close the current model
   */
  closeModel() {
    if (this.currentModel) {
      this.ifcManager.close(this.currentModel.modelID);
      this.currentModel = null;
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    return this.monitor.exportReport();
  }

  /**
   * Compare with previous load
   */
  compareWithPrevious(previousReport: string) {
    const snapshot = this.monitor.getSnapshots()[this.monitor.getSnapshots().length - 1];
    if (!snapshot) return null;

    const previous = JSON.parse(previousReport);
    return this.monitor.compareSnapshots(previous.name, snapshot.name);
  }

  /**
   * Estimate geometry memory usage
   */
  private estimateGeometryMemory(model: any): number {
    try {
      if (model && model.mesh) {
        const geometry = model.mesh.geometry;
        if (geometry) {
          let total = 0;
          
          const attributes = geometry.attributes;
          for (const key in attributes) {
            const attr = attributes[key];
            total += attr.array.byteLength;
          }
          
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
}

/**
 * Usage Example in React Component
 * 
 * This shows how to use the monitoring in a React component like IFCViewer
 */

/*
import { useEffect, useRef, useState } from 'react';
import { IFCViewerWithMonitoring } from './PerformanceMonitor.integration.example';

function IFCViewer() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const viewerRef = useRef<IFCViewerWithMonitoring | null>(null);

  useEffect(() => {
    viewerRef.current = new IFCViewerWithMonitoring();
    return () => {
      if (viewerRef.current) {
        viewerRef.current.closeModel();
      }
    };
  }, []);

  const handleLoad = async (url: string) => {
    if (!viewerRef.current) return;
    
    setLoading(true);
    setProgress(0);
    
    try {
      await viewerRef.current.loadIFC(url, (p) => setProgress(p));
      
      // Get performance report
      const report = viewerRef.current.getPerformanceReport();
      console.log('Performance Report:', report);
      
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => handleLoad('/Demo.ifc')}>
        Load Demo IFC
      </button>
      {loading && <div>Loading... {progress}%</div>}
    </div>
  );
}
*/
