import { expectTypeOf, test } from "vitest";
import { createRootRoute, createRoute, createRouter } from "./create-route.ts";
import { createLink } from "./link.ts";

test("router.navigate({to: route}) requires params when route has them", () => {
  const rootRoute = createRootRoute();
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/about",
  });
  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });
  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
  });

  const routeTree = rootRoute.addChildren([aboutRoute, catsRoute.addChildren([catDetailRoute])]);
  const router = createRouter({ routeTree, basepath: "/" });

  // OK — paramless route, params optional
  router.navigate({ to: aboutRoute });

  // OK — route with params, providing them
  router.navigate({ to: catDetailRoute, params: { id: "whiskers" } });

  // @ts-expect-error — params required for catDetailRoute
  router.navigate({ to: catDetailRoute });

  // @ts-expect-error — wrong param key
  router.navigate({ to: catDetailRoute, params: { wrong: "x" } });

  // OK — search + hash + replace
  router.navigate({
    to: catDetailRoute,
    params: { id: "x" },
    search: { tab: "info", page: 2 },
    hash: "section",
    replace: true,
  });
});

test("createLink infers params from the route", () => {
  const rootRoute = createRootRoute();
  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });
  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
  });

  const routeTree = rootRoute.addChildren([catsRoute.addChildren([catDetailRoute])]);
  const router = createRouter({ routeTree, basepath: "/" });

  const link = createLink(router, {
    to: catDetailRoute,
    params: { id: "whiskers" },
  });
  expectTypeOf(link.href).toEqualTypeOf<string>();
  expectTypeOf(link.onClick).toMatchTypeOf<(event: MouseEvent) => void>();

  // @ts-expect-error — params required
  createLink(router, { to: catDetailRoute });
});
