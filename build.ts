import solidTransformPlugin from "@opentui/solid/bun-plugin"

const external = ["solid-js", "@opentui/solid", "@opencode-ai/plugin"]

async function build(entry: string, outfile: string) {
  const result = await Bun.build({
    entrypoints: [entry],
    target: "bun",
    format: "esm",
    plugins: [solidTransformPlugin],
    external,
  })
  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }
  const artifact = result.outputs.find((o) => o.kind === "entry-point")
  if (!artifact) {
    console.error(`未找到 ${entry} 的产物`)
    process.exit(1)
  }
  await Bun.write(outfile, artifact)
  console.log(`✓ ${entry} -> ${outfile} (${artifact.size} bytes)`)
}

await build("src/index.tsx", "dist/tui.js")
await build("src/server.ts", "dist/index.js")
