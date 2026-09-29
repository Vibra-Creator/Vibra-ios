import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TEST_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

interface Credentials {
  email: string;
  password: string;
  name: string;
}

async function registerUser(request: APIRequestContext, label: string): Promise<Credentials> {
  const credentials = {
    email: `test_marketplace_${label}_${RUN_ID}@vibra-e2e.invalid`,
    password: "Vibra_E2ePass1!",
    name: `Marketplace_${label}_${RUN_ID}`,
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

function uploadFiles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `marketplace-${index + 1}.png`,
    mimeType: "image/png",
    buffer: TEST_IMAGE,
  }));
}

test("authenticated listings and public photos survive a reload", async ({ page, request }) => {
  const user = await registerUser(request, "persistence");
  await loginAs(request, user);

  // A Marketplace listing without photos is rejected by the authenticated API.
  const noPhotoResponse = await request.post("/api/hub-posts", {
    data: {
      category: "marketplace",
      subcategory: "Elettronica",
      title: `No photo ${RUN_ID}`,
      description: "This should be rejected by the Marketplace photo requirement.",
      imageUrls: [],
    },
  });
  expect(noPhotoResponse.status()).toBe(400);
  expect((await noPhotoResponse.json()).error).toContain("almeno 3 foto");

  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  await page.goto("/marketplace", { waitUntil: "load" });
  await expect(page.getByTestId("marketplace-fab")).toBeVisible();
  await page.getByTestId("marketplace-fab").click();

  const title = `Persistent listing ${RUN_ID}`;
  await page.getByPlaceholder(/Titolo/).fill(title);
  await page.getByPlaceholder(/Descrizione/).fill("Listing used to verify Marketplace persistence.");

  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/hub-posts/upload-image") && response.request().method() === "POST",
  );
  await page.locator('input[type="file"]').setInputFiles(uploadFiles(3));
  expect((await uploadResponse).status()).toBe(200);
  await expect(page.getByText("Foto caricate", { exact: true })).toBeVisible();

  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/hub-posts") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Pubblica", exact: true }).click();
  expect((await publishResponse).status()).toBe(200);
  await expect(page.getByText("Annuncio pubblicato", { exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  const listingImages = page.locator(`img[alt^="${title}"]`);
  await expect(listingImages).toHaveCount(3);

  const listingResponse = page.waitForResponse((response) =>
    response.url().includes("/api/hub-posts?category=marketplace"),
  );
  await page.reload({ waitUntil: "load" });
  expect((await listingResponse).status()).toBe(200);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.locator(`img[alt^="${title}"]`)).toHaveCount(3);

  const listing = ((await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{
    title: string;
    imageUrls: string[];
  }>).find((post) => post.title === title);
  expect(listing?.imageUrls).toHaveLength(3);
  expect(listing?.imageUrls.every((url) => url.startsWith("/objects/"))).toBe(true);

  // The object endpoint must serve each uploaded image without a session.
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5000";
  for (const imageUrl of listing?.imageUrls || []) {
    const publicResponse = await fetch(new URL(imageUrl, baseURL));
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get("content-type")).toContain("image/png");
    expect((await publicResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);
  }
});

test.describe("missing Marketplace photo", () => {
  // The app's service worker can bypass Playwright's route interception.
  test.use({ serviceWorkers: "block" });

  test("a missing public photo shows an accessible fallback without hiding listing details", async ({ page, request }) => {
    const user = await registerUser(request, "missing-photo");
    await loginAs(request, user);
    const images: string[] = [];
    for (const file of uploadFiles(3)) {
      const upload = await request.post("/api/hub-posts/upload-image", {
        multipart: { images: file },
      });
      expect(upload.status(), await upload.text()).toBe(200);
      images.push(...((await upload.json()) as { urls: string[] }).urls);
    }
    expect(images).toHaveLength(3);
    const title = `Missing photo listing ${RUN_ID}`;
    const description = "Listing details remain available when a photo is gone.";
    const publish = await request.post("/api/hub-posts", {
      data: { category: "marketplace", title, description, price: 42, city: "Roma", imageUrls: images },
    });
    expect(publish.status(), await publish.text()).toBe(200);
    const listings = (await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{ title: string }>;
    const listing = listings.find((post) => post.title === title);
    expect(listing).toBeDefined();

    await injectSessionCookies(page, request);
    await patchEmailVerified(page);
    await page.route("**/api/hub-posts?category=marketplace", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([listing]) }),
    );
    let intercepted = 0;
    await page.route((url) => url.pathname === images[0], (route) => {
      intercepted++;
      return route.fulfill({ status: 404, body: "Not found" });
    });
    await page.goto("/marketplace", { waitUntil: "load" });
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 20_000 });
    const card = page.locator("div.rounded-2xl.overflow-hidden").filter({ has: page.getByText(title, { exact: true }) });
    await expect(card.getByRole("img", { name: `${title}, foto non disponibile 1` })).toBeVisible();
    expect(intercepted).toBeGreaterThan(0);
    await expect(card.locator(`img[alt="${title} 1"]`)).toHaveCount(0);
    await expect(card.locator(`img[alt^="${title}"]`)).toHaveCount(2);
    await expect(card.getByText(title, { exact: true })).toBeVisible();
    await expect(card.getByText(description, { exact: true })).toBeVisible();
    await expect(card.getByText("€42", { exact: true })).toBeVisible();
    await expect(card.getByText("Roma", { exact: true })).toBeVisible();
  });
});

test("deleting a listing removes only its unreferenced stored photos", async ({ request }) => {
  const otherUser = await registerUser(request, "photo-owner");
  await loginAs(request, otherUser);
  const profileUpload = await request.post("/api/profiles/upload-photo", {
    multipart: { photo: { name: "profile.png", mimeType: "image/png", buffer: TEST_IMAGE } },
  });
  expect(profileUpload.status(), await profileUpload.text()).toBe(200);
  const otherUserPhoto = ((await profileUpload.json()) as { url: string }).url;
  const otherMarketplaceUpload = await request.post("/api/hub-posts/upload-image", {
    multipart: { images: { name: "other-marketplace.png", mimeType: "image/png", buffer: TEST_IMAGE } },
  });
  expect(otherMarketplaceUpload.status(), await otherMarketplaceUpload.text()).toBe(200);
  const otherMarketplacePhoto = ((await otherMarketplaceUpload.json()) as { urls: string[] }).urls[0];

  const user = await registerUser(request, "deletion");
  await loginAs(request, user);

  const images: string[] = [];
  for (let index = 0; index < 5; index++) {
    const upload = await request.post("/api/hub-posts/upload-image", {
      multipart: { images: { name: `deletion-${index}.png`, mimeType: "image/png", buffer: TEST_IMAGE } },
    });
    expect(upload.status(), await upload.text()).toBe(200);
    images.push(...((await upload.json()) as { urls: string[] }).urls);
  }

  async function createListing(title: string, imageUrls: string[]): Promise<string> {
    const response = await request.post("/api/hub-posts", {
      data: { category: "marketplace", title, description: "Listing deletion test", imageUrls },
    });
    expect(response.status(), await response.text()).toBe(200);
    return ((await response.json()) as { id: string }).id;
  }

  const first = await createListing(`First deletion ${RUN_ID}`, [...images.slice(0, 3), otherUserPhoto, otherMarketplacePhoto]);
  const second = await createListing(`Second deletion ${RUN_ID}`, [images[2], ...images.slice(3)]);
  for (const image of images) expect((await request.get(image)).status()).toBe(200);

  expect((await request.delete(`/api/hub-posts/${first}`)).status()).toBe(200);
  for (const image of images.slice(0, 2)) expect((await request.get(image)).status()).toBe(404);
  for (const image of images.slice(2)) expect((await request.get(image)).status()).toBe(200);
  expect((await request.get(otherUserPhoto)).status()).toBe(200);
  expect((await request.get(otherMarketplacePhoto)).status()).toBe(200);
  const remaining = (await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{ id: string }>;
  expect(remaining.some((post) => post.id === second)).toBe(true);

  expect((await request.delete(`/api/hub-posts/${second}`)).status()).toBe(200);
  for (const image of images.slice(2)) expect((await request.get(image)).status()).toBe(404);
  expect((await request.get(otherUserPhoto)).status()).toBe(200);
  expect((await request.get(otherMarketplacePhoto)).status()).toBe(200);
});

test("upload and publication errors are surfaced in the Marketplace UI", async ({ page, request }) => {
  const user = await registerUser(request, "errors");
  await loginAs(request, user);
  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  await page.goto("/marketplace", { waitUntil: "load" });
  await page.getByTestId("marketplace-fab").click();

  const publishButton = page.getByRole("button", { name: "Pubblica", exact: true });
  await page.getByPlaceholder(/Titolo/).fill(`Error listing ${RUN_ID}`);
  await page.getByPlaceholder(/Descrizione/).fill("Listing used to verify visible Marketplace errors.");
  await expect(publishButton).toBeDisabled();

  await page.route("**/api/hub-posts/upload-image", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Upload failure from e2e" }),
    }),
  );
  await page.locator('input[type="file"]').setInputFiles(uploadFiles(1));
  await expect(page.getByText("Upload failure from e2e", { exact: true })).toBeVisible();
  await page.unroute("**/api/hub-posts/upload-image");

  await page.route("**/api/hub-posts/upload-image", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        urls: [
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        ],
      }),
    }),
  );
  await page.locator('input[type="file"]').setInputFiles(uploadFiles(3));
  await expect(page.getByText("Foto caricate", { exact: true })).toBeVisible();
  await page.unroute("**/api/hub-posts/upload-image");

  await page.route("**/api/hub-posts", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Publication failure from e2e" }),
    }),
  );
  await publishButton.click();
  await expect(page.getByText(/Publication failure from e2e/)).toBeVisible();
});