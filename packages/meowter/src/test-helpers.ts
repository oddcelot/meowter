import { expect, vi, type MockInstance } from "vitest";
import type { MeowRouter } from "./router-element.ts";
import type { RouteChangeDetail } from "./events.ts";

export function setURL(path: string): void {
  window.history.replaceState(null, "", path);
}

function clickEvent(extra: MouseEventInit = {}): MouseEvent {
  return new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    ...extra,
  });
}

export function mountRouter(
  innerHTML: string = "",
  attrs: string = "",
): MeowRouter {
  document.body.innerHTML = `<meow-router ${attrs}>${innerHTML}</meow-router>`;
  return document.body.firstElementChild as MeowRouter;
}

export async function tick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export function captureRouteEvents(
  router: MeowRouter,
): CustomEvent<RouteChangeDetail>[] {
  const events: CustomEvent<RouteChangeDetail>[] = [];
  router.addEventListener("route-change", (e) => events.push(e));
  return events;
}

export function spyPushState(): MockInstance<typeof window.history.pushState> {
  return vi.spyOn(window.history, "pushState");
}

export function spyReplaceState(): MockInstance<
  typeof window.history.replaceState
> {
  return vi.spyOn(window.history, "replaceState");
}

type HistorySpy = MockInstance<
  (data: unknown, unused: string, url?: string | URL | null) => void
>;

export function lastPushedURL(spy: HistorySpy): URL {
  const raw = spy.mock.calls.at(-1)?.[2];
  if (raw == null) throw new Error("history spy was not called");
  return new URL(String(raw), window.location.origin);
}

export function expectPushedPath(spy: HistorySpy, pathname: string): void {
  expect(lastPushedURL(spy).pathname).toBe(pathname);
}

export function dispatchAnchorClick(
  router: MeowRouter,
  selector: string,
  extra: MouseEventInit = {},
): MouseEvent {
  const target = router.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`anchor not found: ${selector}`);
  const event = clickEvent(extra);
  target.dispatchEvent(event);
  return event;
}

export function expectIntercepted(
  event: MouseEvent,
  pushSpy: HistorySpy,
  events: CustomEvent<RouteChangeDetail>[],
  pathname: string,
): void {
  expect(event.defaultPrevented).toBe(true);
  expect(pushSpy).toHaveBeenCalledOnce();
  expect(events).toHaveLength(1);
  expect(events[0]!.detail.url.pathname).toBe(pathname);
}

export function expectNotIntercepted(
  event: MouseEvent,
  pushSpy: HistorySpy,
  events: CustomEvent<RouteChangeDetail>[],
): void {
  expect(event.defaultPrevented).toBe(false);
  expect(pushSpy).not.toHaveBeenCalled();
  expect(events).toHaveLength(0);
}
