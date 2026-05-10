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

/**
 * Open registry consumers augment with their generated route paths.
 *
 * Augmentations live in a `meowter-routes.d.ts` file (emitted by the
 * codegen Vite plugin / CLI). Each registered path is a key whose value
 * is `never` so the registry can't be used as runtime data.
 *
 * @example
 * ```ts
 * declare module "meowter" {
 *   interface RouteRegistry {
 *     "/": never;
 *     "/cats": never;
 *     "/cats/:id": never;
 *   }
 * }
 * ```
 */
export interface RouteRegistry {}

/**
 * Expand `:param` segments to `${string}` so concrete URLs (e.g.
 * `/cats/whiskers`) satisfy the registered pattern (`/cats/:id`).
 */
export type ResolveParams<P extends string> =
  P extends `${infer Pre}:${string}/${infer Rest}`
    ? `${Pre}${string}/${ResolveParams<Rest>}`
    : P extends `${infer Pre}:${string}`
      ? `${Pre}${string}`
      : P;

/**
 * The union of paths declared in `RouteRegistry`, with `:param` segments
 * resolved to `${string}`. Falls back to `string` when no augmentations
 * are present (fresh project, no codegen run yet).
 *
 * Use as an explicit type annotation to opt into compile-time route
 * checking:
 *
 * ```ts
 * const home: RegisteredPath = "/";          // ✓
 * const typo: RegisteredPath = "/cats!";     // ✗ TS error
 * router.navigate(home);
 * ```
 */
export type RegisteredPath =
  keyof RouteRegistry extends never
    ? string
    : ResolveParams<Extract<keyof RouteRegistry, string>>;
