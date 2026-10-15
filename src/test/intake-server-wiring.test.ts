import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(resolve("src/server.ts"), "utf8");

describe("CRM intake runtime wiring", () => {
  it("imports and invokes the CRM intake API before falling through to SSR", () => {
    expect(serverSource).toContain(
      'import { handleCrmIntakeApi } from "./server/intake-api";',
    );
    expect(serverSource).toContain(
      "const intakeResponse = await handleCrmIntakeApi(request, env);",
    );
    expect(serverSource).toContain(
      "if (intakeResponse) return intakeResponse;",
    );

    const intakeCall = serverSource.indexOf("handleCrmIntakeApi(request, env)");
    const ssrCall = serverSource.indexOf("getServerEntry()");
    expect(intakeCall).toBeGreaterThan(-1);
    expect(ssrCall).toBeGreaterThan(intakeCall);
  });
});
