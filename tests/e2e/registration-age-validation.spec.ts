import { test, expect } from "@playwright/test";

test("registration API requires an adult age", async ({ request }) => {
  const base = {
    email: `missing_age_${Date.now()}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: "Age Validation",
    termsAccepted: true,
  };

  const missingAge = await request.post("/api/auth/register", { data: base });
  expect(missingAge.status()).toBe(400);
  expect(await missingAge.json()).toEqual({
    message: "L'età deve essere un numero intero tra 18 e 120 anni",
  });

  const underage = await request.post("/api/auth/register", {
    data: { ...base, email: `underage_${Date.now()}@vibra-e2e.invalid`, age: 17 },
  });
  expect(underage.status()).toBe(400);
  expect(await underage.json()).toEqual({
    message: "L'età deve essere un numero intero tra 18 e 120 anni",
  });
});
