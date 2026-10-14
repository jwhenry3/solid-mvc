/**
 * The revenue chart as a WORKER island app: echarts' SVG renderer emits
 * ordinary DOM ops (createElementNS, attr, style, listen), so the whole
 * chart — axis, line, area, tooltip — renders on the dedicated chart
 * thread and replays into the dashboard's mount box.
 *
 * It is PROPS-DRIVEN: the dashboard's own ['revenue'] query result crosses
 * the wire as the `data` prop (12 numbers — nothing), which keeps
 * QueryClient, FakeApi, and the BroadcastChannel cache bridge OUT of this
 * worker. The worker heap is echarts + the islands runtime and nothing
 * else.
 *
 * Geometry: echarts.init reads clientWidth/getComputedStyle SYNCHRONOUSLY,
 * and on the proxy DOM those are 0/empty until the driver pushes real
 * geometry — initing at mount is what logs '[proxyDom] clientWidth has no
 * synchronous answer' and ECharts' 'Can't get DOM width or height'. So
 * bind() defers init to the first observeSize rect and keeps the size
 * live via doc.onResize for layout changes after mount.
 */
import { createEffect } from 'solid-js';
import { Component, Controller, View, inject, type OnDestroy } from '@solid-mvc/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { AxisPointerComponent, GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import zrenv from 'zrender/lib/core/env';
import { installDomShim } from '@solid-mvc/atoll-island/worker';
import type { ProxyElement, ProxyDocument } from '@solid-mvc/atoll-island/worker';

// Modular echarts: the worker only ever draws a line chart on SVG. The
// full `import * as echarts from 'echarts'` drags every chart type,
// component, and renderer into the worker bundle — this is the biggest
// share of its heap.
// AxisPointerComponent is not optional here: its view owns the
// globalListener record that turns zrender 'globalout' into
// updateAxisPointer(currTrigger:'leave') — without it an axis-trigger
// tooltip can show but never hides when the pointer leaves.
echarts.use([LineChart, GridComponent, TooltipComponent, AxisPointerComponent, SVGRenderer]);

// At module-eval time inside a real worker, `typeof document ===
// 'undefined'`, so zrender stamps env.worker=true and zrender.ts builds
// NO event proxy (`!env.node && !env.worker && !ssr`) — the chart would
// render but never receive pointer input. The proxy DOM is DOM-shaped,
// so the flags are flipped before the first echarts.init; env is a
// mutable singleton read at init time, not import time. Pointer-local
// coords arrive as zrX/zrY on the event payload (see @atolljs/islands
// buildEventPayload), so no coordinate transform is needed here.
zrenv.worker = false;
zrenv.domSupported = true;
zrenv.hasGlobalWindow = true;
zrenv.svgSupported = true;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Controller()
export class RevenueChartController implements OnDestroy {
  private el?: ProxyElement;
  private chart?: echarts.ECharts;
  private dark = false;

  /** Solid ref target — typed as a real element, a ProxyElement at runtime. */
  bind = (el: HTMLDivElement | null): void => {
    if (!el || this.el === (el as unknown as ProxyElement)) return;
    const pel = el as unknown as ProxyElement;
    this.el = pel;
    const doc = pel.doc as ProxyDocument;
    // zrender reads el.ownerDocument.defaultView.getComputedStyle — the
    // facade only exists once the DOM shim installs it (window facade:
    // empty computed style, never-matching matchMedia, pushed-size
    // innerWidth/Height, devicePixelRatio, instance-scoped timers + rAF).
    installDomShim(doc);
    // The chart div fills the island container's box — mark it so
    // clientWidth/offsetWidth/getBoundingClientRect report the pushed size.
    doc.markContainer(pel);
    // Defer echarts.init until the driver pushes a real rect — reads are
    // 0/empty before the first setRects task (see the file-header note).
    const unobserve = doc.observeSize(pel, (rect) => {
      if (rect.w === 0 || rect.h === 0) return;
      unobserve();
      this.init();
    });
    doc.onResize(() => this.chart?.resize());
  };

  /**
   * Called during render() — in-instance scope — when data/theme change.
   * The dispatch task's sync lane re-renders the app on EVERY event (any
   * zrender mousemove included), so setOption must be reference-guarded:
   * re-setting identical options rebuilds the whole svg tree — the flicker.
   */
  private lastData?: number[];

  sync(data: number[] | undefined, dark: boolean): void {
    if (dark !== this.dark) {
      this.dark = dark;
      if (this.chart) {
        this.init(); // echarts theme is init-time — re-init
        return;
      }
    }
    if (data === this.lastData) return;
    this.apply(data);
  }

  private init(): void {
    this.chart?.dispose();
    this.chart = echarts.init(
      this.el as unknown as HTMLElement,
      this.dark ? 'dark' : undefined,
      { renderer: 'svg' },
    );
    // Mount order: render() → commit → ref.bind → init. The first sync()
    // ran before the chart existed, so apply the latest data here too —
    // a later updateProps may never fire, there is no second render.
    this.apply(this.lastIncoming);
  }

  /** The newest data prop seen — init() replays it after (re-)init so a
   *  dark-toggle re-init doesn't blank the chart. */
  private lastIncoming?: number[];

  private apply(data: number[] | undefined): void {
    this.lastIncoming = data;
    if (!this.chart || !data) return;
    this.lastData = data;
    this.chart.setOption({
      xAxis: {
        type: 'category',
        data: MONTHS,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { opacity: 0.15 } } },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2.5 },
          color: 'hsl(221 83% 53%)',
          // Hover state swaps el.style for a state-scoped style; on the
          // proxy DOM the restore path loses stroke/fill (attr remove ops)
          // and the series disappears. Emphasis adds nothing here anyway —
          // same stroke, no symbols — so disable the state swap.
          emphasis: { disabled: true },
          select: { disabled: true },
        },
      ],
      grid: { left: 50, right: 12, top: 12, bottom: 28 },
      // renderMode 'richText' draws the tooltip INSIDE the svg — the
      // default 'html' mode is a div whose show() writes style.cssText and
      // hide() writes style.visibility/opacity, and per-prop writes dedup
      // against a _styleProps map cssText never updates — only the first
      // hide ever emits. richText hides are zrender attr ops — no DOM
      // tooltip element, no desync, less wire traffic.
      tooltip: { trigger: 'axis', renderMode: 'richText', hideDelay: 0 },
    });
  }

  /** Container mouseleave → hide tip + axis pointer inside this dispatch
   *  task. echarts' own globalout chain covers it too — the explicit
   *  hideTip is idempotent insurance for leaves zrender doesn't classify
   *  as globalout. */
  hideTip(): void {
    this.chart?.dispatchAction({ type: 'hideTip' });
  }

  onDestroy(): void {
    this.chart?.dispose();
    this.chart = undefined;
  }
}

@Component({ controllers: [RevenueChartController] })
export class RevenueChartIsland extends View<{ dark?: boolean; data?: number[] }> {
  readonly c = inject(RevenueChartController);

  render() {
    const c = this.c;
    // The props arrive via updateProps — the adapter writes each key to a
    // per-prop signal, so this effect re-syncs in instance scope on every
    // push; sync() only touches echarts when data/theme actually moved
    // (reference-guarded).
    createEffect(() => {
      c.sync(this.props.data, this.props.dark === true);
    });
    return (
      <div
        ref={c.bind}
        style="width:100%;height:100%"
        onMouseLeave={() => c.hideTip()}
      />
    );
  }
}
