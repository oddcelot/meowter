import { expectTypeOf, test } from "vitest";
import { createFileRoute, createFileRootRoute } from "./file-routes.ts";

test("createFileRoute infers params from the path literal", () => {
  createFileRoute("/cats/:id")({
    render: ({ params }) => {
      expectTypeOf(params()).toEqualTypeOf<{ id: string }>();
      return null;
    },
  });

  createFileRoute("/posts/:postId/comments/:commentId")({
    render: ({ params }) => {
      expectTypeOf(params()).toEqualTypeOf<{
        postId: string;
        commentId: string;
      }>();
      return null;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  createFileRoute("/about")({
    render: ({ params }) => {
      expectTypeOf(params()).toEqualTypeOf<{}>();
      return null;
    },
  });

  createFileRoute("*")({
    render: ({ params }) => {
      expectTypeOf(params()).toEqualTypeOf<{ _splat: string }>();
      return null;
    },
  });
});

test("createFileRootRoute is typed as path '/'", () => {
  const root = createFileRootRoute();
  expectTypeOf(root.path).toEqualTypeOf<"/">();
});
