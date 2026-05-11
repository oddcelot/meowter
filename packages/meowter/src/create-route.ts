import type { Accessor } from "@solidjs/signals";
import "./router-element.ts";
import "./route-element.ts";
import "./outlet-element.ts";
import type { MeowRouter } from "./router-element.ts";
import type { MeowRoute } from "./route-element.ts";
import type { ResolveParams } from "./index.ts";

// ---------------------------------------------------------------------------
// Path-string parsing types
// ---------------------------------------------------------------------------

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type TrimLeft<S extends string> = S extends `/${infer R}` ? TrimLeft<R> : S;
type TrimRight<S extends string> = S extends `${infer R}/` ? TrimRight<R> : S;
type NormalizeSlash<S extends string> = S extends "" ? "/" : S;

/** Extract the names of all `:param` segments in a path string. */
export type ExtractParamNames<P extends string> =
  P extends `${string}:${infer Name}/${infer Rest}`
    ? Name | ExtractParamNames<`/${Rest}`>
    : P extends `${string}:${infer Name}`
      ? Name
      : never;

/**
 * Map a path string to its runtime params record. A path with no `:name`
 * segments produces `{}` (mapped over `never`) so it intersects cleanly
 * with child params; the catch-all `*` produces a `_splat: string` slot.
 */
export type Params<P extends string> = P extends "*"
  ? { _splat: string }
  : { [K in ExtractParamNames<P>]: string };

/** Join a parent fullPath with a child path; treats "" as the index and "*" as catch-all. */
export type JoinPath<A extends string, B extends string> = B extends ""
  ? A
  : B extends "*"
    ? A extends "/" | ""
      ? "/*"
      : `${TrimRight<A>}/*`
    : A extends ""
      ? NormalizeSlash<B>
      : A extends "/"
        ? NormalizeSlash<`/${TrimLeft<B>}`>
        : `${TrimRight<A>}/${TrimLeft<B>}`;

/** Merge a parent's accumulated params with the child's own params. */
export type AllParams<Parent extends AnyRoute, P extends string> =
  Parent extends Route<AnyRoute, string, infer ParentAll, string>
    ? Simplify<ParentAll & Params<P>>
    : Params<P>;

// ---------------------------------------------------------------------------
// Route + Router public types
// ---------------------------------------------------------------------------

export type RouteRenderResult = Node | DocumentFragment | string | null | void;

export interface RouteRenderCtx<Parent extends AnyRoute, P extends string> {
  params: Accessor<AllParams<Parent, P>>;
  matched: Accessor<boolean>;
  route: Route<
    Parent,
    P,
    AllParams<Parent, P>,
    JoinPath<FullPathOf<Parent>, P>
  >;
  router: Router<AnyRoute>;
}

export interface RouteOptions<Parent extends AnyRoute, P extends string> {
  getParentRoute: () => Parent;
  path: P;
  // method-shorthand syntax gives bivariant function-arg checking; required because
  // routes with different concrete `Parent`/`P` are assigned to `AnyRoute` (e.g. in
  // `addChildren`), and strict variance on the ctx parameter would reject those.
  render?(ctx: RouteRenderCtx<Parent, P>): RouteRenderResult;
}

export interface Route<
  Parent extends AnyRoute,
  P extends string,
  AllP,
  FullP extends string,
> {
  readonly __brand: "MeowterRoute";
  readonly path: P;
  readonly fullPath: FullP;
  readonly parent: Parent | null;
  readonly children: readonly AnyRoute[];
  readonly options: RouteOptions<Parent, P>;
  useParams(): Accessor<AllP>;
  useMatched(): Accessor<boolean>;
  addChildren<const C extends readonly AnyRoute[]>(
    children: C,
  ): RouteWithChildren<Parent, P, AllP, FullP, C>;
}

export interface RouteWithChildren<
  Parent extends AnyRoute,
  P extends string,
  AllP,
  FullP extends string,
  Children extends readonly AnyRoute[],
> extends Route<Parent, P, AllP, FullP> {
  readonly children: Children;
}

export type AnyRoute = Route<any, any, any, any>;

export type FullPathOf<R extends AnyRoute> = R extends Route<
  AnyRoute,
  string,
  any,
  infer F
>
  ? F
  : never;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RootRoute = Route<AnyRoute, "/", {}, "/">;

export interface CreateRouterOptions<Tree extends AnyRoute> {
  routeTree: Tree;
  basepath?: string;
}

export interface Router<Tree extends AnyRoute> {
  readonly tree: Tree;
  readonly element: MeowRouter | null;
  /**
   * Build the route DOM (a `<meow-outlet>` plus `<meow-route>` elements per
   * registered route) inside `target`. If `target` is not already inside a
   * `<meow-router>`, one is created and inserted inside `target`. Returns a
   * dispose function that tears down the rendered DOM and listeners.
   */
  mount(target: HTMLElement): () => void;
  navigate(href: RouterPaths<Tree>, state?: unknown): void;
  replace(href: RouterPaths<Tree>, state?: unknown): void;
  currentURL(): URL;
}

/** Walk the tree's fullPath strings into a union, then expand :params to ${string}. */
export type RouterPaths<Tree extends AnyRoute> = ResolveParams<
  CollectFullPaths<Tree>
>;

type CollectFullPaths<R> = R extends RouteWithChildren<
  any,
  any,
  any,
  any,
  infer Children
>
  ? (R extends { fullPath: infer F extends string } ? F : never) | CollectChildren<Children>
  : R extends { fullPath: infer F extends string }
    ? F
    : never;

type CollectChildren<C> = C extends readonly [infer Head, ...infer Tail]
  ? CollectFullPaths<Head> | CollectChildren<Tail>
  : never;

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

interface RouteBindings {
  params: Accessor<Record<string, string>>;
  matched: Accessor<boolean>;
}

const bindings = new WeakMap<AnyRoute, RouteBindings>();
const EMPTY_PARAMS: Record<string, string> = Object.freeze({}) as Record<
  string,
  string
>;
const DEFAULT_PARAMS: Accessor<Record<string, string>> = () => EMPTY_PARAMS;
const DEFAULT_MATCHED: Accessor<boolean> = () => false;

function getBindings(route: AnyRoute): RouteBindings {
  return (
    bindings.get(route) ?? { params: DEFAULT_PARAMS, matched: DEFAULT_MATCHED }
  );
}

function trimLeadingSlash(s: string): string {
  let i = 0;
  while (i < s.length && s[i] === "/") i++;
  return s.slice(i);
}

function trimTrailingSlash(s: string): string {
  let i = s.length;
  while (i > 0 && s[i - 1] === "/") i--;
  return s.slice(0, i);
}

function joinFullPath(parent: string, child: string): string {
  if (child === "") return parent;
  if (child === "*") {
    if (parent === "/" || parent === "") return "/*";
    return `${trimTrailingSlash(parent)}/*`;
  }
  const left = trimTrailingSlash(parent);
  const right = trimLeadingSlash(child);
  if (left === "") return `/${right}`;
  return `${left}/${right}`;
}

function makeRoute<Parent extends AnyRoute, P extends string>(
  options: RouteOptions<Parent, P>,
  parent: Parent | null,
  fullPath: string,
): Route<Parent, P, AllParams<Parent, P>, JoinPath<FullPathOf<Parent>, P>> {
  type Self = Route<
    Parent,
    P,
    AllParams<Parent, P>,
    JoinPath<FullPathOf<Parent>, P>
  >;
  const children: AnyRoute[] = [];
  const self: Self = {
    __brand: "MeowterRoute",
    path: options.path,
    fullPath: fullPath as JoinPath<FullPathOf<Parent>, P>,
    parent,
    options,
    get children(): readonly AnyRoute[] {
      return children;
    },
    useParams(): Accessor<AllParams<Parent, P>> {
      return getBindings(self as unknown as AnyRoute).params as Accessor<
        AllParams<Parent, P>
      >;
    },
    useMatched(): Accessor<boolean> {
      return getBindings(self as unknown as AnyRoute).matched;
    },
    addChildren<C extends readonly AnyRoute[]>(
      kids: C,
    ): RouteWithChildren<
      Parent,
      P,
      AllParams<Parent, P>,
      JoinPath<FullPathOf<Parent>, P>,
      C
    > {
      children.length = 0;
      for (const k of kids) children.push(k);
      return self as unknown as RouteWithChildren<
        Parent,
        P,
        AllParams<Parent, P>,
        JoinPath<FullPathOf<Parent>, P>,
        C
      >;
    },
  };
  return self;
}

export function createRootRoute(opts?: {
  render?: (ctx: RouteRenderCtx<AnyRoute, "/">) => RouteRenderResult;
}): RootRoute {
  const options: RouteOptions<AnyRoute, "/"> = {
    getParentRoute: (): AnyRoute => {
      throw new Error("root route has no parent");
    },
    path: "/",
    ...(opts?.render ? { render: opts.render } : {}),
  };
  return makeRoute<AnyRoute, "/">(options, null, "/") as unknown as RootRoute;
}

export function createRoute<Parent extends AnyRoute, const P extends string>(
  opts: RouteOptions<Parent, P>,
): Route<
  Parent,
  P,
  AllParams<Parent, P>,
  JoinPath<FullPathOf<Parent>, P>
> {
  const parent = opts.getParentRoute();
  const fullPath = joinFullPath(parent.fullPath, opts.path);
  return makeRoute<Parent, P>(opts, parent, fullPath);
}

// ---------------------------------------------------------------------------
// Router — builds DOM from a route tree, wires lifecycle
// ---------------------------------------------------------------------------

interface MountedNode {
  cleanup: () => void;
}

export function createRouter<Tree extends AnyRoute>(
  opts: CreateRouterOptions<Tree>,
): Router<Tree> {
  let routerEl: MeowRouter | null = null;
  let createdRouter = false;
  let rootOutlet: HTMLElement | null = null;
  const mounted: MountedNode[] = [];

  const router: Router<Tree> = {
    tree: opts.routeTree,
    get element() {
      return routerEl;
    },
    mount(target: HTMLElement): () => void {
      const existing = target.closest("meow-router") as MeowRouter | null;
      if (existing) {
        routerEl = existing;
        createdRouter = false;
        if (opts.basepath !== undefined) routerEl.basepath = opts.basepath;
      } else {
        const el = document.createElement("meow-router") as MeowRouter;
        if (opts.basepath !== undefined) el.setAttribute("basepath", opts.basepath);
        target.appendChild(el);
        routerEl = el;
        createdRouter = true;
      }
      const host = createdRouter ? routerEl : target;
      const outlet = document.createElement("meow-outlet");
      host.appendChild(outlet);
      rootOutlet = outlet;
      buildChildren(outlet, opts.routeTree);
      return dispose;
    },
    navigate(href, state) {
      routerEl?.navigate(href as string, state);
    },
    replace(href, state) {
      routerEl?.replace(href as string, state);
    },
    currentURL(): URL {
      if (!routerEl) return new URL(window.location.href);
      return routerEl.currentURL();
    },
  };

  function buildChildren(outlet: HTMLElement, parentRoute: AnyRoute): void {
    for (const child of parentRoute.children) {
      const routeEl = document.createElement("meow-route") as MeowRoute;
      routeEl.setAttribute("path", child.path);
      outlet.appendChild(routeEl);

      const paramsAcc = routeEl.paramsAccessor;
      bindings.set(child, {
        params: () => paramsAcc() ?? EMPTY_PARAMS,
        matched: routeEl.matchedAccessor,
      });

      const cleanup = wireRender(child, routeEl);
      mounted.push({ cleanup });

      if (child.children.length > 0) {
        const nestedOutlet = document.createElement("meow-outlet");
        routeEl.appendChild(nestedOutlet);
        buildChildren(nestedOutlet, child);
      }
    }
  }

  function wireRender(route: AnyRoute, routeEl: MeowRoute): () => void {
    const render = route.options.render;
    if (!render) return () => {};

    let mountedNode: Node | null = null;

    const ctx: RouteRenderCtx<AnyRoute, string> = {
      params: route.useParams() as Accessor<AllParams<AnyRoute, string>>,
      matched: route.useMatched(),
      route: route as unknown as RouteRenderCtx<AnyRoute, string>["route"],
      router: router as Router<AnyRoute>,
    };

    const doMount = (): void => {
      if (mountedNode) return;
      const result = render(ctx);
      const node = normalizeRenderResult(result);
      if (!node) return;
      const nestedOutlet = routeEl.querySelector(":scope > meow-outlet");
      if (nestedOutlet) routeEl.insertBefore(node, nestedOutlet);
      else routeEl.appendChild(node);
      mountedNode = node;
    };

    const doUnmount = (): void => {
      if (mountedNode && mountedNode.parentNode === routeEl) {
        routeEl.removeChild(mountedNode);
      }
      mountedNode = null;
    };

    routeEl.addEventListener("route-match", doMount);
    routeEl.addEventListener("route-leave", doUnmount);

    // If the route is already matched at mount time (initial URL), kick it.
    queueMicrotask(() => {
      if (routeEl.matched) doMount();
    });

    return () => {
      routeEl.removeEventListener("route-match", doMount);
      routeEl.removeEventListener("route-leave", doUnmount);
      doUnmount();
    };
  }

  function dispose(): void {
    for (const m of mounted) m.cleanup();
    mounted.length = 0;
    if (rootOutlet?.parentNode) rootOutlet.parentNode.removeChild(rootOutlet);
    rootOutlet = null;
    if (createdRouter && routerEl?.parentNode) {
      routerEl.parentNode.removeChild(routerEl);
    }
    routerEl = null;
    createdRouter = false;
  }

  return router;
}

function normalizeRenderResult(result: RouteRenderResult): Node | null {
  if (result == null) return null;
  if (typeof result === "string") return document.createTextNode(result);
  return result;
}
