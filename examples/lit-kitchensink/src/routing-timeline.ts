import { addTimelineEvent, addTimelineLayer } from "virtual:lit-plugin/timeline";
import type { MeowRoute } from "meowter";

/**
 * Puts meowter's routing events on a "Routing" lane in the Lit DevTools
 * timeline. Dev-only: the virtual module is a no-op stub in `vite build`.
 *
 * The events bubble and are composed, so one set of listeners on `<html>`
 * sees every router and route on the page.
 */
const LAYER = "meowter-routing";

addTimelineLayer({ id: LAYER, label: "Routing", color: 0xf472b6 });

const root = document.documentElement;

root.addEventListener("route-change", (e) => {
  const { url, state } = e.detail;
  addTimelineEvent({
    layerId: LAYER,
    time: performance.now(),
    title: "change",
    subtitle: url.pathname + url.search,
    data: { href: url.href, state },
  });
});

root.addEventListener("route-match", (e) => {
  const { url, params, consumed } = e.detail;
  addTimelineEvent({
    layerId: LAYER,
    time: performance.now(),
    title: "match",
    subtitle: (e.target as MeowRoute).path,
    data: { href: url.href, params, consumed },
  });
});

root.addEventListener("route-leave", (e) => {
  addTimelineEvent({
    layerId: LAYER,
    time: performance.now(),
    title: "leave",
    subtitle: (e.target as MeowRoute).path,
    data: { href: e.detail.url.href },
  });
});
