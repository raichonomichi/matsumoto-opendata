import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "pipelines/**/*.test.ts"],
  },
});
