import type { Accessor } from "@solidjs/signals";
import {
  createRootRoute,
  createRoute,
  type AllParams,
  type AnyRoute,
  type FullPathOf,
  type JoinPath,
  type Params,
  type RootRoute,
  type Route,
  type RouteRenderResult,
  type Router,
} from "./create-route.ts";

// ---------------------------------------------------------------------------
// FileRoute — a "detached" route value: knows its full path + config, but
// not its parent. The codegen (`routeTree.gen.ts`) calls `bindFileRoute` to
// late-bind the parent and produce a real `Route`.
// ---------------------------------------------------------------------------

export interface FileRouteRenderCtx<P extends string> {
  params: Accessor<Params<P>>;
  matched: Accessor<boolean>;
  route: Route<AnyRoute, string, Params<P>, P>;
  router: Router<AnyRoute>;
}

export interface FileRouteConfig<P extends string> {
  // method-shorthand for bivariant fn-arg checking (same reason as RouteOptions.render)
  render?(ctx: FileRouteRenderCtx<P>): RouteRenderResult;
}

export interface FileRoute<P extends string> {
  readonly __brand: "MeowterFileRoute";
  readonly path: P;
  readonly config: FileRouteConfig<P>;
}

/**
 * Declare a file-based route. The path literal flows into generics so the
 * `params` accessor inside `render` is typed against the path's `:param`
 * segments.
 *
 * @example
 * ```ts
 * // src/routes/cats.$id.route.ts
 * export const Route = createFileRoute("/cats/:id")({
 *   render: ({ params }) => `cat ${params().id}`,
 * });
 * ```
 */
export function createFileRoute<const P extends string>(
  path: P,
): <Cfg extends FileRouteConfig<P>>(config: Cfg) => FileRoute<P> {
  return (config) => ({
    __brand: "MeowterFileRoute",
    path,
    config: config as FileRouteConfig<P>,
  });
}

/**
 * Declare the root route. Always has path `/`. Optional render attaches a
 * frame around all child routes (e.g. a global layout).
 */
export function createFileRootRoute(config: FileRouteConfig<"/"> = {}): FileRoute<"/"> {
  return {
    __brand: "MeowterFileRoute",
    path: "/",
    config,
  };
}

/**
 * Internal — called by `routeTree.gen.ts` to bind a `FileRoute` to its
 * parent and produce a real `Route`. The codegen passes the literal
 * `ownPath` segment (e.g. `":id"` or `""` for index) which feeds into the
 * runtime path-compile + `JoinPath<...>` type inference.
 *
 * The parent's `Parent` and the child's own `P` generics are erased to
 * `string` here because the gen file passes them dynamically — the full
 * path is still typed through the `JoinPath<FullPathOf<Parent>, OwnPath>`
 * computation in the gen file's local type usage.
 */
export function bindFileRoute<Parent extends AnyRoute, const Own extends string>(
  fileRoute: FileRoute<string>,
  parent: Parent,
  ownPath: Own,
): Route<Parent, Own, AllParams<Parent, Own>, JoinPath<FullPathOf<Parent>, Own>> {
  const route = createRoute({
    getParentRoute: () => parent,
    path: ownPath,
    ...(fileRoute.config.render ? { render: fileRoute.config.render } : {}),
  });
  // createRoute<Parent, const P>'s return narrows P to whatever the literal
  // `ownPath` is; TS occasionally widens through the generic boundary, so
  // cast to the exact public return shape.
  return route as unknown as Route<
    Parent,
    Own,
    AllParams<Parent, Own>,
    JoinPath<FullPathOf<Parent>, Own>
  >;
}

/**
 * Internal — bind the root route. Delegates to `createRootRoute` so the
 * runtime treats it as a root (no parent), and threads through the
 * optional render config.
 */
export function bindFileRootRoute(fileRoute: FileRoute<"/">): RootRoute {
  return createRootRoute(
    fileRoute.config.render ? { render: fileRoute.config.render as never } : undefined,
  );
}
