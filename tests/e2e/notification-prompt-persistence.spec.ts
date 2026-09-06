import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PUSH_DECISION_KEY = "vibra-push-decision-made";

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_notifications_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `Notifications_${label}_${RUN_ID}`,
  };
  const response = await request.post("/api/auth/register", {
    data: { ...credentials, age: 25 },
  });
  if (!response.ok()) {
    throw new Error(`Register ${label}: ${response.status()} – ${await response.text()}`);
  }
  return credentials;
}

async function loginAs(request: APIRequestContext, credentials: Credentials) {
  const response = await request.post("/api/auth/login", { data: credentials });
  if (!response.ok()) {
    throw new Error(`Login ${credentials.email}: ${response.status()} – ${await response.text()}`);
  }
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

async function patchEmailVerified(page: Page) {
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

async function prepareAuthenticatedPage(
  page: Page,
  request: APIRequestContext,
  credentials: Credentials,
  options: { supported?: boolean; permission?: "default" | "denied" } = {},
) {
  const { supported = true, permission = "default" } = options;

  await page.addInitScript(
    ({ supported, permission }) => {
      window.localStorage.setItem("vibra-splash-seen", "1");

      const originalNotification = window.Notification;
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: new Proxy(originalNotification, {
          get(target, property, receiver) {
            if (property === "permission") return permission;
            if (property === "requestPermission") {
              return async () => {
                (window as typeof window & { __notificationPermissionCalls?: number })
                  .__notificationPermissionCalls =
                  ((window as typeof window & { __notificationPermissionCalls?: number })
                    .__notificationPermissionCalls || 0) + 1;
                return "denied";
              };
            }
            return Reflect.get(target, property, receiver);
          },
        }),
      });

      if (!supported) {
        delete (window as typeof window & { PushManager?: unknown }).PushManager;
      }
    },
    { supported, permission },
  );
  await loginAs(request, credentials);
  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  await page.goto("/", { waitUntil: "load" });
}

test("notification prompt appears only when supported and undecided", async ({ page, request }) => {
  const supportedUser = await registerUser(request, "supported");
  await prepareAuthenticatedPage(page, request, supportedUser);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("button-dismiss-notifications-banner")).toBeVisible();

  const unsupportedUser = await registerUser(request, "unsupported");
  await prepareAuthenticatedPage(page, request, unsupportedUser, { supported: false });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});

test("dismissing the notification prompt persists after reload", async ({ page, request }) => {
  const user = await registerUser(request, "dismiss");
  await prepareAuthenticatedPage(page, request, user);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-dismiss-notifications-banner").click();

  await expect(banner).not.toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PUSH_DECISION_KEY))
    .toBe("true");

  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});

test("allow requests permission from the button and stays hidden when declined", async ({ page, request }) => {
  const user = await registerUser(request, "allow-declined");
  await prepareAuthenticatedPage(page, request, user);

  const banner = page.getByTestId("notification-banner");
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("button-enable-notifications-banner").click();

  await expect
    .poll(() => page.evaluate(() => (window as typeof window & { __notificationPermissionCalls?: number })
      .__notificationPermissionCalls || 0))
    .toBe(1);
  await expect(banner).not.toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PUSH_DECISION_KEY))
    .toBe("true");

  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("notification-banner")).not.toBeVisible();
});