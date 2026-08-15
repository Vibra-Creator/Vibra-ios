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

import { test, expect, type APIRequestContext } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Credentials { email: string; password: string; name: string; }

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const email = `test_${label}_${RUN_ID}@vibra-e2e.invalid`;
  const password = "Vibra_E2ePass1!";
  const name = `TestUser_${label}_${RUN_ID}`;
  const res = await request.post("/api/auth/register", { data: { email, password, name, age: 25 } });
  if (!res.ok()) throw new Error(`Register ${label}: ${res.status()} – ${await res.text()}`);
  return { email, password, name };
}

async function loginAs(req: APIRequestContext, creds: Credentials): Promise<string> {
  const lr = await req.post("/api/auth/login", { data: { email: creds.email, password: creds.password } });
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
