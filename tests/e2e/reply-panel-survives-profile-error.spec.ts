/**
 * E2E test – Task #21
 *
 * Confirms that the cold-message reply panel survives a network error while
 * loading the sender's profile.
 *
 * Setup notes:
 *   - Test accounts are registered with emailVerified: false (no real email
 *     server in test). The app's App.tsx shows an <EmailVerificationGate>
 *     whenever emailVerified === false, preventing the vibrapp route from
 *     rendering. We work around this by intercepting the /api/auth/user
 *     response in the browser and patching emailVerified: true — the real
 *     session and all other APIs still run against the live server.
 *   - The session cookie from the API request context is injected into the
 *     browser page so that /api/profiles/me and /api/cold-messages/received
 *     authenticate successfully.
 */

import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let registeredUserCount = 0;

interface Credentials { email: string; password: string; name: string; }

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const uniqueId = `${RUN_ID}_${++registeredUserCount}`;
  const email = `test_${label}_${uniqueId}@vibra-e2e.invalid`;
  const password = "Vibra_E2ePass1!";
  const name = `TestUser_${label}_${uniqueId}`;
  const res = await request.post("/api/auth/register", {
    data: { email, password, name, age: 25, termsAccepted: true },
  });
  if (!res.ok()) throw new Error(`Register ${label}: ${res.status()} – ${await res.text()}`);
  return { email, password, name };
}

async function loginAs(req: APIRequestContext, creds: Credentials): Promise<string> {
  const lr = await req.post("/api/auth/login", {
    data: { email: creds.email, password: creds.password, termsAccepted: true },
  });
  if (!lr.ok()) throw new Error(`Login ${creds.email}: ${lr.status()} – ${await lr.text()}`);
  const pr = await req.get("/api/profiles/me");
  if (!pr.ok()) throw new Error(`profiles/me: ${pr.status()} – ${await pr.text()}`);
  return ((await pr.json()) as { id: string }).id;
}

test("reply panel stays visible and shows error toast when profile fetch returns 500", async ({
  page,
  request,
}) => {
  // ── 1. Register users and build the cold message via the API ─────────────
  const userA = await registerUser(request, "A"); // recipient
  const userB = await registerUser(request, "B"); // sender

  const profileAId = await loginAs(request, userA);
  const profileBId = await loginAs(request, userB); // session is now B's

  const sendRes = await request.post("/api/cold-messages", {
    data: { toProfileId: profileAId, content: `E2E intro ${RUN_ID}` },
  });
  if (!sendRes.ok()) throw new Error(`Send cold msg: ${sendRes.status()} – ${await sendRes.text()}`);

  // Switch back to A and confirm inbox
  await loginAs(request, userA);
  const inboxJson = (await (await request.get("/api/cold-messages/received")).json()) as Array<{
    id: string; fromProfileId: string;
  }>;
  const coldMsg = inboxJson.find((m) => m.fromProfileId === profileBId);
  if (!coldMsg) throw new Error("Cold message not in A's inbox – setup failed");
  const coldMsgId = coldMsg.id;

  // ── 2. Copy session cookie (A) from API context → browser ─────────────────
  // request.storageState() contains the connect.sid that was set when we
  // logged in as A above — inject it so the browser sends it with every request.
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await page.context().addCookies(
      state.cookies.map((c) => ({
        name:     c.name,
        value:    c.value,
        domain:   "localhost",
        path:     c.path || "/",
        httpOnly: c.httpOnly ?? true,
        secure:   false,
        sameSite: "Lax" as const,
      }))
    );
  }

  // ── 3. Patch the /api/auth/user response to mark email as verified ────────
  // Test accounts are created with emailVerified: false (no email server).
  // App.tsx (line 322-341) shows <EmailVerificationGate> when emailVerified
  // is false, preventing the authenticated routes from rendering. We intercept
  // the response and set emailVerified: true so the app loads normally.
  // All other requests (including the session check) go through to the real server.
  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    if (response.ok()) {
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...body, emailVerified: true }),
      });
    } else {
      await route.fulfill({ response });
    }
  });

  // ── 4. Navigate to /vibrapp; wait for cold-messages/received ──────────────
  const coldMsgsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/cold-messages/received"),
    { timeout: 20_000 }
  );
  await page.goto("/vibrapp", { waitUntil: "load" });
  await coldMsgsFetched;

  // ── 5. Open the reply panel ───────────────────────────────────────────────
  const introBubble = page.locator(`[data-testid="intro-bubble-${coldMsgId}"]`);
  await expect(introBubble).toBeVisible({ timeout: 10_000 });
  await introBubble.click();

  const replyPanel = page.locator('[data-testid="coldmsg-reply-panel"]');
  await expect(replyPanel).toBeVisible({ timeout: 5_000 });

  // ── 6. Intercept the sender's profile fetch so it returns 500 ─────────────
  await page.route(`**/api/profiles/${profileBId}`, (route) =>
    route.fulfill({ status: 500, body: "Internal Server Error" })
  );

  // ── 7. Tap the sender avatar ──────────────────────────────────────────────
  const avatarBtn = page.locator('[data-testid="button-view-sender-profile"]');
  await expect(avatarBtn).toBeVisible();
  await avatarBtn.click();

  // ── 8. Reply panel must STILL be visible (error must not close it) ────────
  await expect(replyPanel).toBeVisible({ timeout: 3_000 });

  // ── 9. Error toast must appear ────────────────────────────────────────────
  const toast = page.locator('[data-testid="sender-profile-toast"]');
  await expect(toast).toBeVisible({ timeout: 3_000 });
  await expect(toast).toContainText(/profilo|errore/i);
});

test("error toast auto-dismisses after ~3.5 s so it never permanently blocks the reply panel", async ({
  page,
  request,
}) => {
  // ── 1. Register users and build the cold message via the API ─────────────
  const userA = await registerUser(request, "A");
  const userB = await registerUser(request, "B");

  const profileAId = await loginAs(request, userA);
  const profileBId = await loginAs(request, userB);

  const sendRes = await request.post("/api/cold-messages", {
    data: { toProfileId: profileAId, content: `E2E dismiss ${RUN_ID}` },
  });
  if (!sendRes.ok()) throw new Error(`Send cold msg: ${sendRes.status()} – ${await sendRes.text()}`);

  await loginAs(request, userA);
  const inboxJson = (await (await request.get("/api/cold-messages/received")).json()) as Array<{
    id: string; fromProfileId: string;
  }>;
  const coldMsg = inboxJson.find((m) => m.fromProfileId === profileBId);
  if (!coldMsg) throw new Error("Cold message not in A's inbox – setup failed");
  const coldMsgId = coldMsg.id;

  // ── 2. Copy session cookie (A) from API context → browser ─────────────────
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await page.context().addCookies(
      state.cookies.map((c) => ({
        name:     c.name,
        value:    c.value,
        domain:   "localhost",
        path:     c.path || "/",
        httpOnly: c.httpOnly ?? true,
        secure:   false,
        sameSite: "Lax" as const,
      }))
    );
  }

  // ── 3. Patch /api/auth/user to mark email as verified ────────────────────
  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    if (response.ok()) {
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...body, emailVerified: true }),
      });
    } else {
      await route.fulfill({ response });
    }
  });

  // ── 4. Navigate to /vibrapp ───────────────────────────────────────────────
  const coldMsgsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/cold-messages/received"),
    { timeout: 20_000 }
  );
  await page.goto("/vibrapp", { waitUntil: "load" });
  await coldMsgsFetched;

  // ── 5. Open the reply panel ───────────────────────────────────────────────
  const introBubble = page.locator(`[data-testid="intro-bubble-${coldMsgId}"]`);
  await expect(introBubble).toBeVisible({ timeout: 10_000 });
  await introBubble.click();

  const replyPanel = page.locator('[data-testid="coldmsg-reply-panel"]');
  await expect(replyPanel).toBeVisible({ timeout: 5_000 });

  // ── 6. Intercept the sender's profile fetch so it returns 500 ─────────────
  await page.route(`**/api/profiles/${profileBId}`, (route) =>
    route.fulfill({ status: 500, body: "Internal Server Error" })
  );

  // ── 7. Tap the sender avatar to trigger the error ─────────────────────────
  const avatarBtn = page.locator('[data-testid="button-view-sender-profile"]');
  await expect(avatarBtn).toBeVisible();
  await avatarBtn.click();

  // ── 8. Toast must appear first ────────────────────────────────────────────
  const toast = page.locator('[data-testid="sender-profile-toast"]');
  await expect(toast).toBeVisible({ timeout: 3_000 });

  // ── 9. After 4 s the toast must have disappeared on its own ───────────────
  // The production code clears it after 3 500 ms; we give an extra 500 ms margin.
  await expect(toast).not.toBeVisible({ timeout: 4_500 });

  // ── 10. Reply panel must still be visible (toast gone, panel intact) ───────
  await expect(replyPanel).toBeVisible();
});

test("double-tap on sender avatar shows only one toast and it auto-dismisses after ~4 s", async ({
  page,
  request,
}) => {
  // ── 1. Register users and build the cold message via the API ─────────────
  const userA = await registerUser(request, "A");
  const userB = await registerUser(request, "B");

  const profileAId = await loginAs(request, userA);
  const profileBId = await loginAs(request, userB);

  const sendRes = await request.post("/api/cold-messages", {
    data: { toProfileId: profileAId, content: `E2E double-tap ${RUN_ID}` },
  });
  if (!sendRes.ok()) throw new Error(`Send cold msg: ${sendRes.status()} – ${await sendRes.text()}`);

  await loginAs(request, userA);
  const inboxJson = (await (await request.get("/api/cold-messages/received")).json()) as Array<{
    id: string; fromProfileId: string;
  }>;
  const coldMsg = inboxJson.find((m) => m.fromProfileId === profileBId);
  if (!coldMsg) throw new Error("Cold message not in A's inbox – setup failed");
  const coldMsgId = coldMsg.id;

  // ── 2. Copy session cookie (A) from API context → browser ─────────────────
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await page.context().addCookies(
      state.cookies.map((c) => ({
        name:     c.name,
        value:    c.value,
        domain:   "localhost",
        path:     c.path || "/",
        httpOnly: c.httpOnly ?? true,
        secure:   false,
        sameSite: "Lax" as const,
      }))
    );
  }

  // ── 3. Patch /api/auth/user to mark email as verified ────────────────────
  await page.route("**/api/auth/user", async (route) => {
    const response = await route.fetch();
    if (response.ok()) {
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...body, emailVerified: true }),
      });
    } else {
      await route.fulfill({ response });
    }
  });

  // ── 4. Navigate to /vibrapp ───────────────────────────────────────────────
  const coldMsgsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/cold-messages/received"),
    { timeout: 20_000 }
  );
  await page.goto("/vibrapp", { waitUntil: "load" });
  await coldMsgsFetched;

  // ── 5. Open the reply panel ───────────────────────────────────────────────
  const introBubble = page.locator(`[data-testid="intro-bubble-${coldMsgId}"]`);
  await expect(introBubble).toBeVisible({ timeout: 10_000 });
  await introBubble.click();

  const replyPanel = page.locator('[data-testid="coldmsg-reply-panel"]');
  await expect(replyPanel).toBeVisible({ timeout: 5_000 });

  // ── 6. Intercept the sender's profile fetch so it always returns 500 ──────
  await page.route(`**/api/profiles/${profileBId}`, (route) =>
    route.fulfill({ status: 500, body: "Internal Server Error" })
  );

  // ── 7. First tap on the sender avatar ────────────────────────────────────
  const avatarBtn = page.locator('[data-testid="button-view-sender-profile"]');
  await expect(avatarBtn).toBeVisible();
  const t0 = Date.now();
  await avatarBtn.click();

  // ── 8. Toast must appear ──────────────────────────────────────────────────
  const toast = page.locator('[data-testid="sender-profile-toast"]');
  await expect(toast).toBeVisible({ timeout: 3_000 });

  // ── 9. Second tap while toast is still visible ────────────────────────────
  // The avatar button is re-enabled after the first request resolves.
  // Tapping again must not stack a second toast — exactly one must be present.
  await avatarBtn.click();

  // Wait briefly for any duplicate to potentially appear
  await page.waitForTimeout(300);

  // Only one toast instance should be in the DOM at any given time
  await expect(page.locator('[data-testid="sender-profile-toast"]')).toHaveCount(1);

  // ── 10. Toast must disappear within ~4 s of the FIRST tap ─────────────────
  // The timer is reset (not stacked) on the second tap, so at most 3 500 ms
  // from the last tap — well within 5 s of the first tap.
  const elapsed = Date.now() - t0;
  const remaining = Math.max(0, 5_000 - elapsed);
  await expect(toast).not.toBeVisible({ timeout: remaining + 1_000 });

  // ── 11. Reply panel must still be intact after the toast fades ────────────
  await expect(replyPanel).toBeVisible();
});

test("sender sees an unavailable notice when the recipient deletes a message while their profile is open", async ({
  page,
  request,
}, testInfo) => {
  const recipient = await registerUser(request, "recipient_delete_race");
  const sender = await registerUser(request, "sender_delete_race");
  const recipientProfileId = await loginAs(request, recipient);
  const senderProfileId = await loginAs(request, sender);
  const messageContent = `E2E deleted while profile is open ${RUN_ID}`;
  const sendResponse = await request.post("/api/cold-messages", {
    data: { toProfileId: recipientProfileId, content: messageContent },
  });
  if (!sendResponse.ok()) {
    throw new Error(`Send cold msg: ${sendResponse.status()} – ${await sendResponse.text()}`);
  }

  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:5000");
  const recipientSession = await playwrightRequest.newContext({ baseURL });
  try {
    const sessionRecipientId = await loginAs(recipientSession, recipient);
    if (sessionRecipientId !== recipientProfileId) {
      throw new Error("Recipient session resolved to a different profile");
    }
    const inboxResponse = await recipientSession.get("/api/cold-messages/received");
    if (!inboxResponse.ok()) {
      throw new Error(`Recipient inbox: ${inboxResponse.status()} – ${await inboxResponse.text()}`);
    }
    const inbox = (await inboxResponse.json()) as Array<{ id: string; fromProfileId: string }>;
    const coldMessage = inbox.find((message) => message.fromProfileId === senderProfileId);
    if (!coldMessage) throw new Error("Cold message not in recipient's inbox – setup failed");

    // The sender opens the sent message from its notification deep link.
    await loginAs(request, sender);
    const state = await request.storageState();
    const baseUrl = new URL(baseURL);
    await page.context().addCookies(
      state.cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: baseUrl.hostname,
        path: cookie.path || "/",
        httpOnly: cookie.httpOnly ?? true,
        secure: baseUrl.protocol === "https:",
        sameSite: "Lax" as const,
      })),
    );

    await page.route("**/api/auth/user", async (route) => {
      const response = await route.fetch();
      if (response.ok()) {
        const body = (await response.json()) as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...body, emailVerified: true }),
        });
      } else {
        await route.fulfill({ response });
      }
    });

    const messageResponse = page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/cold-messages/${coldMessage.id}`),
    );
    await page.goto(`/vibrapp?coldMessageId=${encodeURIComponent(coldMessage.id)}`, {
      waitUntil: "load",
    });
    const openedMessageResponse = await messageResponse;
    expect(openedMessageResponse.status()).toBe(200);
    expect(await openedMessageResponse.json()).toMatchObject({
      id: coldMessage.id,
      content: messageContent,
      isSentByMe: true,
    });

    const targetBanner = page.locator('[data-testid="intro-target-banner"]');
    await expect(targetBanner).toBeVisible({ timeout: 10_000 });
    const sentMessageBubble = page.locator(
      `[data-testid="sent-intro-bubble-${coldMessage.id}"]`,
    );
    await expect(sentMessageBubble).toBeVisible();
    await page.locator('[data-testid="button-view-intro-target-profile"]').click();
    const profileModal = page.locator('[data-testid="profile-detail-modal"]');
    await expect(profileModal).toBeVisible();

    // The recipient deletes the message in their independent authenticated session.
    const deleteResponse = await recipientSession.delete(
      `/api/cold-messages/${coldMessage.id}`,
    );
    if (!deleteResponse.ok()) {
      throw new Error(`Delete cold msg: ${deleteResponse.status()} – ${await deleteResponse.text()}`);
    }

    const revalidation = page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      response.url().includes(`/api/cold-messages/${coldMessage.id}`),
    );
    await page.locator('[data-testid="button-modal-close"]').click();
    const revalidationResponse = await revalidation;
    expect(revalidationResponse.status()).toBe(404);
    expect(await revalidationResponse.json()).toMatchObject({ reason: "message_deleted" });

    await expect(page.locator('[data-testid="sender-profile-toast"]')).toContainText(
      "Questo messaggio non è più disponibile",
    );
    await expect(targetBanner).not.toBeVisible();
    await expect(sentMessageBubble).not.toBeVisible();
    await expect(page.getByText(messageContent, { exact: true })).toHaveCount(0);
  } finally {
    await recipientSession.dispose();
  }
});
