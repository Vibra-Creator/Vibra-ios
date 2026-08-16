/**
 * E2E test – Task #34
 *
 * Confirms that the "already reported" banner (data-testid="banner-already-reported")
 * and its "Gestisci segnalazione" link (data-testid="link-gestisci-segnalazione")
 * appear correctly when a user opens a cold message from a profile they have
 * already reported.
 *
 * Why the received-strip interception is needed
 * ─────────────────────────────────────────────
 * storage.getColdMessagesReceived() filters out messages from reported senders
 * at the DB level. This means once A reports B, B's cold message no longer
 * appears in the received strip — so the intro-bubble is never rendered and
 * the reply panel cannot be opened through normal navigation.
 *
 * The banner is designed for the "stale-cache" scenario: the user already has
 * the cold message visible in the UI (cached before the report was created),
 * then the /api/reports/mine query refreshes and the banner appears. We
 * reproduce this by intercepting the browser's /api/cold-messages/received
 * request and injecting the cold message that was obtained before the report.
 *
 * Setup notes:
 *   - Test accounts are registered with emailVerified: false (no real email
 *     server in test). App.tsx shows <EmailVerificationGate> when emailVerified
 *     is false. We intercept /api/auth/user and patch emailVerified: true so
 *     the vibrapp route renders normally.
 *   - The session cookie from the API request context is injected into the
 *     browser page so that authenticated API calls succeed.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

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

async function injectSessionCookies(page: Page, request: APIRequestContext) {
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
}

async function patchEmailVerified(page: Page) {
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
}

test("banner-already-reported appears when the sender has been reported", async ({
  page,
  request,
}) => {
  // ── 1. Register two users ────────────────────────────────────────────────
  const userA = await registerUser(request, "A"); // recipient / reporter
  const userB = await registerUser(request, "B"); // sender / to be reported

  // ── 2. User B sends a cold message to user A ─────────────────────────────
  const profileAId = await loginAs(request, userA);
  const profileBId = await loginAs(request, userB); // session is now B's

  const sendRes = await request.post("/api/cold-messages", {
    data: { toProfileId: profileAId, content: `E2E banner test ${RUN_ID}` },
  });
  if (!sendRes.ok()) throw new Error(`Send cold msg: ${sendRes.status()} – ${await sendRes.text()}`);

  // ── 3. Switch to A; capture the cold message BEFORE reporting ─────────────
  // getColdMessagesReceived filters out messages from reported senders, so we
  // must read the inbox while the report does not exist yet.
  await loginAs(request, userA);

  const inboxRes = await request.get("/api/cold-messages/received");
  const inboxJson = (await inboxRes.json()) as Array<{ id: string; fromProfileId: string; [key: string]: unknown }>;
  const coldMsg = inboxJson.find((m) => m.fromProfileId === profileBId);
  if (!coldMsg) throw new Error("Cold message not in A's inbox – setup failed");
  const coldMsgId = coldMsg.id;

  // ── 4. User A reports user B ──────────────────────────────────────────────
  const reportRes = await request.post("/api/reports", {
    data: { reportedId: profileBId, reason: "spam" },
  });
  if (!reportRes.ok()) throw new Error(`Create report: ${reportRes.status()} – ${await reportRes.text()}`);
  const reportRow = (await reportRes.json()) as { id: string; reportedId: string };

  // ── 5. Inject A's session into the browser ────────────────────────────────
  await injectSessionCookies(page, request);

  // ── 6. Patch emailVerified so <EmailVerificationGate> is bypassed ─────────
  await patchEmailVerified(page);

  // ── 7. Intercept /api/cold-messages/received to inject B's message ────────
  // The real endpoint would filter out reported senders at the DB level.
  // We serve the pre-report snapshot so the intro-bubble appears in the UI,
  // reproducing the "stale cache" scenario the banner is designed for.
  await page.route("**/api/cold-messages/received", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(inboxJson),
    })
  );

  // ── 8. Set up response waiters BEFORE navigating ─────────────────────────
  const reportsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/reports/mine"),
    { timeout: 20_000 }
  );

  await page.goto("/vibrapp", { waitUntil: "load" });

  // Wait for /api/reports/mine so reportedProfileIds is populated
  await reportsFetched;

  // ── 9. Open the cold message from user B ──────────────────────────────────
  const introBubble = page.locator(`[data-testid="intro-bubble-${coldMsgId}"]`);
  await expect(introBubble).toBeVisible({ timeout: 10_000 });
  await introBubble.click();

  const replyPanel = page.locator('[data-testid="coldmsg-reply-panel"]');
  await expect(replyPanel).toBeVisible({ timeout: 5_000 });

  // ── 10. Banner must be visible ────────────────────────────────────────────
  const banner = page.locator('[data-testid="banner-already-reported"]');
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await expect(banner).toContainText(/segnalato/i);

  // ── 11. "Gestisci segnalazione" link must navigate to /profile?segnalazioni=1
  const manageLink = page.locator('[data-testid="link-gestisci-segnalazione"]');
  await expect(manageLink).toBeVisible();
  await manageLink.click();

  await expect(page).toHaveURL(/\/profile\?segnalazioni=1/, { timeout: 5_000 });
});

test("banner-already-reported is absent when the sender has NOT been reported", async ({
  page,
  request,
}) => {
  // ── 1. Register two users ────────────────────────────────────────────────
  const userA = await registerUser(request, "C"); // recipient
  const userB = await registerUser(request, "D"); // sender (never reported)

  // ── 2. User B sends a cold message to user A ─────────────────────────────
  const profileAId = await loginAs(request, userA);
  const profileBId = await loginAs(request, userB);

  const sendRes = await request.post("/api/cold-messages", {
    data: { toProfileId: profileAId, content: `E2E no-banner test ${RUN_ID}` },
  });
  if (!sendRes.ok()) throw new Error(`Send cold msg: ${sendRes.status()} – ${await sendRes.text()}`);

  // ── 3. Switch to A, get coldMsgId (no report created) ────────────────────
  await loginAs(request, userA);

  const inboxJson = (await (await request.get("/api/cold-messages/received")).json()) as Array<{
    id: string; fromProfileId: string;
  }>;
  const coldMsg = inboxJson.find((m) => m.fromProfileId === profileBId);
  if (!coldMsg) throw new Error("Cold message not in A's inbox – setup failed");
  const coldMsgId = coldMsg.id;

  // ── 4. Inject A's session and bypass email gate ───────────────────────────
  await injectSessionCookies(page, request);
  await patchEmailVerified(page);

  // ── 5. Set up response waiters BEFORE navigating ─────────────────────────
  const coldMsgsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/cold-messages/received"),
    { timeout: 20_000 }
  );
  const reportsFetched = page.waitForResponse(
    (r) => r.url().includes("/api/reports/mine"),
    { timeout: 20_000 }
  );

  await page.goto("/vibrapp", { waitUntil: "load" });
  await coldMsgsFetched;
  await reportsFetched;

  // ── 6. Open the cold message ──────────────────────────────────────────────
  const introBubble = page.locator(`[data-testid="intro-bubble-${coldMsgId}"]`);
  await expect(introBubble).toBeVisible({ timeout: 10_000 });
  await introBubble.click();

  const replyPanel = page.locator('[data-testid="coldmsg-reply-panel"]');
  await expect(replyPanel).toBeVisible({ timeout: 5_000 });

  // ── 7. Banner must NOT be present ────────────────────────────────────────
  const banner = page.locator('[data-testid="banner-already-reported"]');
  await expect(banner).not.toBeVisible();
});
