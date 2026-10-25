import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The service-role client bypasses RLS: only the AI report route may use it.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/api/ai/reports/route.ts", "src/lib/supabase/admin.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/supabase/admin"],
              allowTypeImports: true,
              message: "The service-role client bypasses RLS. Only src/app/api/ai/reports/route.ts may import it (see CLAUDE.md, AI layer).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
