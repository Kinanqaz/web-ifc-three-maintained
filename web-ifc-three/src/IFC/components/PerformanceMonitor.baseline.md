# Performance Monitor Baseline Test

## Step 0 Implementation Complete

### Files Created
1. `PerformanceMonitor.ts` - Main performance monitoring class
2. `BenchmarkSuite.ts` - Benchmark scenario management
3. `index.ts` - Export file for components
4. `PerformanceMonitor.test.ts` - Test utility with console functions
5. `PerformanceMonitor.integration.example.ts` - Integration example for Navio

### How to Test

#### Option 1: Browser Console Test
1. Import the test utility in your app:
```typescript
import { testPerformanceMonitor, compareWithBaseline, runBenchmarkSuite } from './IFC/components/PerformanceMonitor.test';
```

2. Run in browser console:
```javascript
testPerformanceMonitor()
```

3. This will:
- Load Demo.ifc
- Measure parse time
- Estimate memory usage
- Print performance report
- Save baseline to localStorage

4. Compare with baseline later:
```javascript
compareWithBaseline()
```

#### Option 2: Integration in Navio App
See `PerformanceMonitor.integration.example.ts` for how to integrate into IFCViewer component.

### Metrics Captured
- **Memory**: Heap size, geometry buffers, textures, total
- **Loading**: Parse time, geometry processing time, total time
- **Rendering**: FPS (avg, min, max), frame time
- **File**: IFC size, compressed size
- **GPU**: Draw calls, buffer sizes, texture memory

### Next Steps
Once baseline is captured, proceed with Step 1: Enhanced Material Pooling
