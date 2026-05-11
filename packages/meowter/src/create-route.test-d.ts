import { expectTypeOf, test } from "vitest";
import { createRootRoute, createRoute, createRouter } from "./create-route.ts";
import type {
  ExtractParamNames,
  JoinPath,
  Params,
  RouterPaths,
} from "./create-route.ts";

test("ExtractParamNames pulls :name segments", () => {
  expectTypeOf<ExtractParamNames<"/">>().toEqualTypeOf<never>();
  expectTypeOf<ExtractParamNames<"/about">>().toEqualTypeOf<never>();
  expectTypeOf<ExtractParamNames<"/cats/:id">>().toEqualTypeOf<"id">();
  expectTypeOf<
    ExtractParamNames<"/cats/:id/litters/:litterId">
  >().toEqualTypeOf<"id" | "litterId">();
});

test("Params maps path strings to records", () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  expectTypeOf<Params<"/">>().toEqualTypeOf<{}>();
  expectTypeOf<Params<"/cats/:id">>().toEqualTypeOf<{ id: string }>();
  expectTypeOf<Params<"/cats/:id/litters/:litterId">>().toEqualTypeOf<{
    id: string;
    litterId: string;
  }>();
  expectTypeOf<Params<"*">>().toEqualTypeOf<{ _splat: string }>();
});

test("JoinPath composes parent and child paths", () => {
  expectTypeOf<JoinPath<"/", "">>().toEqualTypeOf<"/">();
  expectTypeOf<JoinPath<"/", "cats">>().toEqualTypeOf<"/cats">();
  expectTypeOf<JoinPath<"/", "/cats">>().toEqualTypeOf<"/cats">();
  expectTypeOf<JoinPath<"/cats", ":id">>().toEqualTypeOf<"/cats/:id">();
  expectTypeOf<JoinPath<"/cats", "">>().toEqualTypeOf<"/cats">();
  expectTypeOf<JoinPath<"/", "*">>().toEqualTypeOf<"/*">();
  expectTypeOf<JoinPath<"/cats", "*">>().toEqualTypeOf<"/cats/*">();
});

test("createRoute infers fullPath from the path string", () => {
  const rootRoute = createRootRoute();

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/about",
  });
  expectTypeOf(aboutRoute.fullPath).toEqualTypeOf<"/about">();

  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });
  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
  });
  expectTypeOf(catDetailRoute.fullPath).toEqualTypeOf<"/cats/:id">();
});

test("render context exposes typed params accessor", () => {
  const rootRoute = createRootRoute();
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats/:id",
    render: ({ params }) => {
      expectTypeOf(params()).toEqualTypeOf<{ id: string }>();
      return null;
    },
  });
});

test("RouterPaths collects the tree's resolved paths", () => {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "",
  });
  const catsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/cats",
  });
  const catDetailRoute = createRoute({
    getParentRoute: () => catsRoute,
    path: ":id",
  });
  const notFoundRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "*",
  });

  const routeTree = rootRoute.addChildren([
    homeRoute,
    catsRoute.addChildren([catDetailRoute]),
    notFoundRoute,
  ]);

  type AppPaths = RouterPaths<typeof routeTree>;
  expectTypeOf<AppPaths>().toMatchTypeOf<
    "/" | "/cats" | `/cats/${string}` | "/*"
  >();

  const router = createRouter({ routeTree, basepath: "/" });
  router.navigate("/");
  router.navigate("/cats");
  router.navigate("/cats/whiskers");
  router.navigate("/*");
  // @ts-expect-error — "/nope" is not in the path union
  router.navigate("/nope");
});
