/**
 * The chart thread — a dedicated worker for the echarts island, so SVG
 * diffing and zrender's layout never touch the main thread. It hosts one
 * app (`chart`) with NO provider spine: the island is props-driven, so
 * this worker carries no QueryClient, no FakeApi, and no BroadcastChannel
 * cache bridge. Its heap is the islands runtime + modular echarts.
 */
import {
  defineViewPolyWorker,
  viewIslandApp,
  ProxyElement,
} from '@solid-mvc/atoll-island/worker';
import { RevenueChartIsland } from '@/islands/revenue-chart.island';

// zrender probes `canvas.getContext('2d')` for text measurement. A proxy
// element has no getContext, so the probe would TypeError instead of
// taking zrender's font-size estimation path — a null-returning stub
// routes it there. echarts' real drawing is SVG ops; no canvas needed.
if (!(ProxyElement.prototype as { getContext?: unknown }).getContext) {
  (ProxyElement.prototype as { getContext?: () => null }).getContext = () => null;
}

export const worker = defineViewPolyWorker({
  apps: {
    chart: viewIslandApp(RevenueChartIsland),
  },
});
