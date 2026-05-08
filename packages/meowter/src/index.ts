import "./events.ts";
import "./router-element.ts";
import "./route-element.ts";
import "./outlet-element.ts";
import { ensureStyle } from "./fouc.ts";

ensureStyle();

export { MeowRouter } from "./router-element.ts";
export { MeowRoute } from "./route-element.ts";
export { MeowOutlet } from "./outlet-element.ts";
export type {
  RouteChangeDetail,
  RouteMatchDetail,
  RouteLeaveDetail,
} from "./events.ts";
