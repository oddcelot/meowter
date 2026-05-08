import type { MeowRouter } from "./router-element.ts";
import type { MeowRoute } from "./route-element.ts";
import type { MeowOutlet } from "./outlet-element.ts";

export interface RouteChangeDetail {
  url: URL;
  state: unknown;
}

export interface RouteMatchDetail {
  url: URL;
  params: Record<string, string>;
  consumed: string;
}

export interface RouteLeaveDetail {
  url: URL;
}

export interface HistoryEntry {
  id: number;
  href: string;
  state: unknown;
}

export interface HistoryState {
  entries: HistoryEntry[];
  index: number;
}

export interface SetSearchParamOptions {
  history?: "push" | "replace";
}

export type SearchParamValue = string | string[] | null;

declare global {
  interface HTMLElementTagNameMap {
    "meow-router": MeowRouter;
    "meow-route": MeowRoute;
    "meow-outlet": MeowOutlet;
  }
  interface HTMLElementEventMap {
    "route-change": CustomEvent<RouteChangeDetail>;
    "route-match": CustomEvent<RouteMatchDetail>;
    "route-leave": CustomEvent<RouteLeaveDetail>;
  }
}
