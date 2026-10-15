import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(resolve("src/server.ts"), "utf8");

describe("CRM intake runtime wiring", () => {
  it("wires confirmation, submit, and intake handlers before SSR fallback", () => {
    expect(serverSource).toContain(
      'import { handleCrmIntakeApi } from "./server/intake-api";',
    );
    expect(serverSource).toContain(
      'import { handleCrmIntakeConfirmationApi } from "./server/intake-confirmation-api";',
    );
    expect(serverSource).toContain(
      'import { handleCrmIntakeSubmitApi } from "./server/intake-submit-api";',
    );

    expect(serverSource).toContain(
      "const confirmationResponse = await handleCrmIntakeConfirmationApi(",
    );
    expect(serverSource).toContain(
      "const submitResponse = await handleCrmIntakeSubmitApi(request, env);",
    );
    expect(serverSource).toContain(
      "if (submitResponse) return submitResponse;",
    );
    expect(serverSource).toContain(
      "const intakeResponse = await handleCrmIntakeApi(request, env);",
    );
    expect(serverSource).toContain(
      "if (intakeResponse) return intakeResponse;",
    );

    const confirmationCall = serverSource.indexOf(
      "handleCrmIntakeConfirmationApi(",
    );
    const submitCall = serverSource.indexOf(
      "handleCrmIntakeSubmitApi(request, env)",
    );
    const intakeCall = serverSource.indexOf("handleCrmIntakeApi(request, env)");
    const ssrCall = serverSource.indexOf(
      "const handler = await getServerEntry();",
    );

    expect(confirmationCall).toBeGreaterThan(-1);
    expect(submitCall).toBeGreaterThan(confirmationCall);
    expect(intakeCall).toBeGreaterThan(submitCall);
    expect(ssrCall).toBeGreaterThan(intakeCall);
  });
});
