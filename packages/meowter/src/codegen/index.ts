export { extractRoutesFromHtml, type ExtractOptions } from "./extract-routes.ts";
export { emitRouteRegistryDts } from "./emit-dts.ts";
export { meowterRoutes, type MeowterRoutesPluginOptions } from "./vite-plugin.ts";

export { discoverFileRoutes, groupByParent, type DiscoveredRoute } from "./extract-file-routes.ts";
export { emitRouteTree, type EmitOptions } from "./emit-route-tree.ts";
export { meowterFileRoutes, type MeowterFileRoutesPluginOptions } from "./file-routes-plugin.ts";
