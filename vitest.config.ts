import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "./coverage",
      // Measure coverage for all source files in src/.
      // Excludes: auto-generated Chakra UI wrappers, test files, config files.
      include: [
        "src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.d.ts",
        "**/*.config.*",
        "next.config.*",
        // Auto-generated Chakra UI wrapper components — not project logic
        "src/components/ui/**",
        // Test files themselves
        "src/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        // Co-located test files
        "src/components/**/*.test.tsx",
        "src/proxy.ts",
        "src/types/**",
        "src/app/auth/**/route.ts",
        "src/app/**/layout.tsx",          // optional but usually fine
        "src/lib/supabase/client.ts",
        "src/lib/supabase/server.ts",
        "src/utils/supabase/**",
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/__tests__/mocks/server-only.ts")
    }
  }
});
