import { test, expect, type APIRequestContext } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_missing_sender_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `MissingSender_${label}_${RUN_ID}`,
  };
  const response = await request.post("/api/auth/register", {
    data: { ...credentials, age: 25 },
  });
  if (!response.ok()) {
    throw new Error(`Register ${label}: ${response.status()} – ${await response.text()}`);
  }
  return credentials;
}

async function loginAs(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const loginResponse = await request.post("/api/auth/login", {
    data: { email: credentials.email, password: credentials.password },
  });
  if (!loginResponse.ok()) {
    throw new Error(`Login ${credentials.email}: ${loginResponse.status()} – ${await loginResponse.text()}`);
  }
  const profileResponse = await request.get("/api/profiles/me");
  if (!profileResponse.ok()) {
    throw new Error(`profiles/me: ${profileResponse.status()} – ${await profileResponse.text()}`);
  }
  return ((await profileResponse.json()) as { id: string }).id;
}

test("does not open the reply panel when a successful refresh has no sender profile", async ({
  page,
  request,
}) => {
  const recipient = await registerUser(request, "recipient");
  const sender = await registerUser(request, "sender");
  const recipientProfileId = await loginAs(request, recipient);
  const senderProfileId = await loginAs(request, sender);

  const sendResponse = await request.post("/api/cold-messages", {
    data: { toProfileId: recipientProfileId, content: `Missing sender ${RUN_ID}` },
  });
  if (!sendResponse.ok()) {
    throw new Error(`Send cold message: ${sendResponse.status()} – ${await sendResponse.text()}`);
  }

  await loginAs(request, recipient);
  const inbox = (await (await request.get("/api/cold-messages/received")).json()) as Array<{
    id: string;
    fromProfileId: string;
  }>;
  const coldMessage = inbox.find((message) => message.fromProfileId === senderProfileId);
  if (!coldMessage) throw new Error("Cold message setup failed");

  const storageState = await request.storageState();
  await page.context().addCookies(
    storageState.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "localhost",
      path: cookie.path || "/",
      httpOnly: cookie.httpOnly ?? true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );

  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      status: response.status(),
      contentType: "application/json",
      body: JSON.stringify({ ...body, emailVerified: true }),
    });
  });

  await page.route(`**/api/cold-messages/${coldMessage.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: coldMessage.id,
        content: `Missing sender ${RUN_ID}`,
        otherProfile: null,
        isSentByMe: false,
      }),
    }),
  );

  const inboxResponse = page.waitForResponse((response) =>
    response.url().includes("/api/cold-messages/received"),
  );
  await page.goto("/vibrapp", { waitUntil: "load" });
  await inboxResponse;

  const bubble = page.locator(`[data-testid="intro-bubble-${coldMessage.id}"]`);
  await expect(bubble).toBeVisible({ timeout: 10_000 });
  await bubble.click();

  await expect(page.locator('[data-testid="coldmsg-reply-panel"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="sender-profile-toast"]')).toContainText(
    "Questo messaggio non è più disponibile",
  );
});