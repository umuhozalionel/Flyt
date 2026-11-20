// MapLibre runs map work in a web worker loaded from its own file. Next does not bundle that file, so it is copied
// into public/vendor (not committed; made again on install, dev and build). MapView points MapLibre at it.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs")
mkdirSync("public/vendor", { recursive: true })
copyFileSync(source, "public/vendor/maplibre-gl-worker.mjs")
