import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_vibrapp_rooms_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `VibrappRooms_${label}_${RUN_ID}`,
  };
  const response = await request.post("/api/auth/register", {
    data: { ...credentials, age: 25, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Register ${label}: ${response.status()} – ${await response.text()}`);
  }
  return credentials;
}

async function loginAs(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const response = await request.post("/api/auth/login", {
    data: { email: credentials.email, password: credentials.password, termsAccepted: true },
  });
  if (!response.ok()) {
    throw new Error(`Login ${credentials.email}: ${response.status()} – ${await response.text()}`);
  }
  const profileResponse = await request.get("/api/profiles/me");
  if (!profileResponse.ok()) {
    throw new Error(`profiles/me: ${profileResponse.status()} – ${await profileResponse.text()}`);
  }
  return ((await profileResponse.json()) as { id: string }).id;
}

async function injectSessionCookies(page: Page, request: APIRequestContext) {
  const state = await request.storageState();
  await page.context().addCookies(
    state.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "localhost",
      path: cookie.path || "/",
      httpOnly: cookie.httpOnly ?? true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function allowUnverifiedTestAccount(page: Page) {
  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      await route.fulfill({ response });
      return;
    }
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...body, emailVerified: true }),
    });
  });
}

test("presentation replies stay in Vibrapp and private rooms remain in their own menu", async ({
  page,
  request,
}) => {
  const recipient = await registerUser(request, "recipient");
  const sender = await registerUser(request, "sender");
  const recipientProfileId = await loginAs(request, recipient);
  const senderProfileId = await loginAs(request, sender);

  const introResponse = await request.post("/api/cold-messages", {
    data: { toProfileId: recipientProfileId, content: `Intro ${RUN_ID}` },
  });
  if (!introResponse.ok()) {
    throw new Error(`Send presentation: ${introResponse.status()} – ${await introResponse.text()}`);
  }

  await loginAs(request, recipient);
  const inboxResponse = await request.get("/api/cold-messages/received");
  const inbox = (await inboxResponse.json()) as Array<{ id: string; fromProfileId: string }>;
  const intro = inbox.find((message) => message.fromProfileId === senderProfileId);
  if (!intro) throw new Error("Presentation was not delivered to the recipient");

  await injectSessionCookies(page, request);
  await allowUnverifiedTestAccount(page);

  const inboxLoaded = page.waitForResponse((response) =>
    response.url().includes("/api/cold-messages/received"),
  );
  await page.goto("/vibrapp", { waitUntil: "load" });
  await inboxLoaded;

  await page.locator(`[data-testid="intro-bubble-${intro.id}"]`).click();
  await page.locator('[data-testid="input-cold-reply"]').fill(`Risposta Vibrapp ${RUN_ID}`);

  const replyResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && response.url().includes(`/api/cold-messages/${intro.id}/reply`),
  );
  await page.locator('[data-testid="button-confirm-cold-reply"]').click();
  const replyResponse = await replyResponsePromise;
  expect(replyResponse.ok()).toBeTruthy();
  const replyBody = (await replyResponse.json()) as {
    dm: { id: string; fromProfileId: string; toProfileId: string; content: string };
    privateRoomId: string | null;
  };
  expect(replyBody.privateRoomId).toBeNull();
  expect(replyBody.dm.fromProfileId).toBe(recipientProfileId);
  expect(replyBody.dm.toProfileId).toBe(senderProfileId);
  expect(replyBody.dm.content).toBe(`Risposta Vibrapp ${RUN_ID}`);

  await expect(page.locator('[data-testid="dm-panel"]')).toBeVisible();
  await expect(page).toHaveURL(/\/vibrapp(?:\?.*)?$/);
  await expect(page).not.toHaveURL(/\/private-room\//);

  const threadResponse = await request.get(`/api/vibrapp-dm/thread/${senderProfileId}`);
  expect(threadResponse.ok()).toBeTruthy();
  const thread = (await threadResponse.json()) as Array<{ id: string; content: string }>;
  expect(thread.some((message) =>
    message.id === replyBody.dm.id && message.content === replyBody.dm.content,
  )).toBe(true);

  // Legacy records may still carry a privateRoomId; they must not send Vibrapp
  // back to that room or hide its normal DM controls.
  await page.route(`**/api/cold-messages/${intro.id}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      contentType: "application/json",
      body: JSON.stringify({ ...body, privateRoomId: "legacy-private-room-id" }),
    });
  });

  // A reply notification's deep link must reopen the same DM, not a private room.
  await page.goto(`/vibrapp?coldMessageId=${encodeURIComponent(intro.id)}`, { waitUntil: "load" });
  await expect(page.locator('[data-testid="intro-target-banner"]')).toBeVisible();
  const vibrappButton = page.locator('[data-testid="button-go-vibrapp-dm"]');
  await expect(vibrappButton).toBeVisible();
  await vibrappButton.click();
  await expect(page.locator('[data-testid="dm-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="dm-panel"]')).toContainText(sender.name);

  // The normal DM notification URL is also handled by Vibrapp's DM panel.
  await page.goto(`/vibrapp?dm=${encodeURIComponent(senderProfileId)}`, { waitUntil: "load" });
  await expect(page.locator('[data-testid="dm-panel"]')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/vibrapp\\?dm=${senderProfileId}$`));

  // Private rooms remain reachable through the separate menu entry.
  await page.locator('[data-testid="button-close-dm-panel"]').click();
  await expect(page.locator('[data-testid="dm-panel"]')).not.toBeVisible();
  await expect(page.locator("#html-splash")).toHaveCount(0, { timeout: 5_000 });
  const privateRoomsLink = page.locator('a[href="/private-rooms"]:visible').first();
  await expect(privateRoomsLink).toBeVisible();
  await privateRoomsLink.click();
  await expect(page).toHaveURL(/\/private-rooms$/);
  await expect(page.locator('[data-testid="text-private-rooms-title"]')).toBeVisible();
});

test("Vibrapp notification and swipe links do not route to private rooms", async () => {
  const [routes, swipeCard, vibrapp] = await Promise.all([
    readFile("server/routes.ts", "utf8"),
    readFile("client/src/components/SwipeCard.tsx", "utf8"),
    readFile("client/src/pages/vibrapp.tsx", "utf8"),
  ]);

  assert.match(
    routes,
    /app\.post\("\/api\/cold-messages\/:id\/reply"[\s\S]*?url:\s*`\/vibrapp\?dm=\$\{dmMsg\.fromProfileId\}`,[\s\S]*?type:\s*"vibrapp-dm"/,
    "presentation-reply notifications must open the sender's Vibrapp DM",
  );
  assert.match(
    routes,
    /url:\s*`\/vibrapp\?dm=\$\{profileId\}`,[\s\S]{0,100}?type:\s*"vibrapp-dm"/,
    "direct-message notifications must open the Vibrapp DM",
  );
  const swipeDmLinks = swipeCard.match(
    /navigate\(`\/vibrapp\?dm=\$\{encodeURIComponent\(profile\.id\)\}`\)/g,
  ) ?? [];
  assert.equal(swipeDmLinks.length, 2, "both SwipeCard Vibrapp paths must open the Vibrapp DM");
  assert.doesNotMatch(
    vibrapp,
    /introPrivateRoomId|setIntroPrivateRoomId/,
    "legacy private-room IDs must not control or suppress Vibrapp's reply flow",
  );
  assert.doesNotMatch(
    routes.match(/app\.post\("\/api\/cold-messages\/:id\/reply"[\s\S]*?(?=\/\/ DELETE a received cold message)/)?.[0] ?? "",
    /\/private-room\//,
    "presentation replies must not create private-room notification links",
  );
});