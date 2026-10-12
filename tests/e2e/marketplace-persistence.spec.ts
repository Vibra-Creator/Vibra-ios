import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ObjectStorageService } from "../../server/replit_integrations/object_storage/objectStorage";

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

test("publication asks sellers to reload a Marketplace photo that disappeared after upload", async ({ page, request }) => {
  const user = await registerUser(request, "vanished-photo");
  await loginAs(request, user);
  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  await page.goto("/marketplace", { waitUntil: "load" });
  await page.getByTestId("marketplace-fab").click();

  const title = `Vanished photo listing ${RUN_ID}`;
  await page.getByPlaceholder(/Titolo/).fill(title);
  await page.getByPlaceholder(/Descrizione/).fill("A missing upload must stop publication.");
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/hub-posts/upload-image") && response.request().method() === "POST",
  );
  await page.locator('input[type="file"]').setInputFiles(uploadFiles(3));
  const uploaded = await uploadResponse;
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const { urls } = (await uploaded.json()) as { urls: string[] };
  expect(urls).toHaveLength(3);
  await expect(page.getByText("Foto caricate", { exact: true })).toBeVisible();

  const disappearedFile = await new ObjectStorageService().getObjectEntityFile(urls[0]);
  await disappearedFile.delete();

  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/hub-posts") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Pubblica", exact: true }).click();
  const publish = await publishResponse;
  expect(publish.status()).toBe(400);
  expect((await publish.json()).error).toContain("Ricarica le foto mancanti");
  await expect(page.getByText(/Ricarica le foto mancanti/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pubblica", exact: true })).toBeVisible();

  const listings = (await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{ title: string }>;
  expect(listings.some((listing) => listing.title === title)).toBe(false);
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

  test("owners can replace and remove missing photos without recreating the listing", async ({ page, request, browser }) => {
    const seller = await registerUser(request, "photo-repair-owner");
    const sellerProfileId = await loginAs(request, seller);
    const images: string[] = [];
    for (const file of uploadFiles(4)) {
      const upload = await request.post("/api/hub-posts/upload-image", { multipart: { images: file } });
      expect(upload.status(), await upload.text()).toBe(200);
      images.push(...((await upload.json()) as { urls: string[] }).urls);
    }

    const title = `Photo repair listing ${RUN_ID}`;
    const description = "The listing should keep all details when a missing photo changes.";
    const publish = await request.post("/api/hub-posts", {
      data: {
        category: "marketplace",
        title,
        description,
        price: 57,
        city: "Milano",
        imageUrls: images,
      },
    });
    expect(publish.status(), await publish.text()).toBe(200);
    const original = (await publish.json()) as { id: string; title: string; description: string; price: number; city: string };

    const outsiderContext = await browser.newContext();
    try {
      const outsiderRequest = outsiderContext.request;
      const outsider = await registerUser(outsiderRequest, "photo-repair-outsider");
      await loginAs(outsiderRequest, outsider);
      const forbiddenEdit = await outsiderRequest.patch(`/api/hub-posts/${original.id}/photos`, {
        data: { action: "remove", imageUrl: images[0] },
      });
      expect(forbiddenEdit.status()).toBe(403);

      const forbiddenReplacement = await outsiderRequest.patch(`/api/hub-posts/${original.id}/photos`, {
        data: { action: "replace", imageUrl: images[2], replacementImageUrl: images[1] },
      });
      expect(forbiddenReplacement.status()).toBe(403);

      const outsiderPage = await outsiderContext.newPage();
      await injectSessionCookies(outsiderPage, outsiderRequest);
      await patchEmailVerified(outsiderPage);
      await outsiderPage.goto("/marketplace", { waitUntil: "load" });
      const outsiderCard = outsiderPage.locator("div.rounded-2xl.overflow-hidden").filter({
        has: outsiderPage.getByText(title, { exact: true }),
      });
      await expect(outsiderCard.locator('img[alt^="Photo repair listing"]')).toHaveCount(4);
      await expect(outsiderCard.getByRole("button", { name: /Sostituisci foto|Rimuovi foto/ })).toHaveCount(0);
    } finally {
      await outsiderContext.close();
    }

    await injectSessionCookies(page, request);
    await patchEmailVerified(page);
    await page.route((url) => url.pathname === images[0] || url.pathname === images[1], (route) =>
      route.fulfill({ status: 404, body: "Not found" }),
    );
    await page.goto("/marketplace", { waitUntil: "load" });
    const card = page.locator("div.rounded-2xl.overflow-hidden").filter({ has: page.getByText(title, { exact: true }) });
    await expect(card.getByRole("button", { name: "Sostituisci foto 1" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Rimuovi foto 2" })).toBeVisible();

    await card.getByRole("button", { name: "Sostituisci foto 1" }).click();
    const firstReplacement = page.waitForResponse((response) =>
      response.url().endsWith(`/api/hub-posts/${original.id}/photos`) &&
      response.request().method() === "PATCH",
    );
    await page.getByTestId("marketplace-replace-photo-1").setInputFiles(uploadFiles(1));
    expect((await firstReplacement).status()).toBe(200);

    await expect(card.getByRole("button", { name: "Sostituisci foto 3" })).toBeVisible();
    await card.getByRole("button", { name: "Sostituisci foto 3" }).click();
    const secondReplacement = page.waitForResponse((response) =>
      response.url().endsWith(`/api/hub-posts/${original.id}/photos`) &&
      response.request().method() === "PATCH",
    );
    await page.getByTestId("marketplace-replace-photo-3").setInputFiles(uploadFiles(1));
    expect((await secondReplacement).status()).toBe(200);

    await card.getByRole("button", { name: "Rimuovi foto 2" }).click();
    await expect(page.getByText("Foto rimossa", { exact: true })).toBeVisible();

    const refreshedPosts = (await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{
      id: string;
      title: string;
      description: string;
      price: number;
      city: string;
      profileId: string;
      imageUrls: string[];
    }>;
    const updated = refreshedPosts.find((post) => post.id === original.id);
    expect(updated).toBeDefined();
    expect(updated).toMatchObject({
      id: original.id,
      title: original.title,
      description: original.description,
      price: original.price,
      city: original.city,
      profileId: sellerProfileId,
    });
    expect(updated?.imageUrls).toHaveLength(3);
    expect(updated?.imageUrls[0]).not.toBe(images[0]);
    expect(updated?.imageUrls[1]).not.toBe(images[2]);
    expect(updated?.imageUrls[2]).toBe(images[3]);
    await expect(card.getByText(title, { exact: true })).toBeVisible();
    await expect(card.locator(`img[alt^="${title}"]`)).toHaveCount(3);
  });
});

test("owners can edit Marketplace details without changing the listing ID or photos", async ({ page, request, browser }) => {
  const seller = await registerUser(request, "details-edit-owner");
  const sellerProfileId = await loginAs(request, seller);
  const images: string[] = [];
  for (const file of uploadFiles(3)) {
    const upload = await request.post("/api/hub-posts/upload-image", { multipart: { images: file } });
    expect(upload.status(), await upload.text()).toBe(200);
    images.push(...((await upload.json()) as { urls: string[] }).urls);
  }

  const title = `Editable listing ${RUN_ID}`;
  const publish = await request.post("/api/hub-posts", {
    data: {
      category: "marketplace",
      subcategory: "Elettronica",
      title,
      description: "Original listing details.",
      price: 50,
      city: "Roma",
      contactInfo: "111111",
      imageUrls: images,
    },
  });
  expect(publish.status(), await publish.text()).toBe(200);
  const original = (await publish.json()) as {
    id: string;
    imageUrl: string;
    imageUrls: string[];
  };

  const outsiderContext = await browser.newContext();
  try {
    const outsiderRequest = outsiderContext.request;
    const outsider = await registerUser(outsiderRequest, "details-edit-outsider");
    await loginAs(outsiderRequest, outsider);
    const forbiddenEdit = await outsiderRequest.patch(`/api/hub-posts/${original.id}/details`, {
      data: {
        title: "Unauthorized title",
        description: "Unauthorized description.",
        price: 99,
        subcategory: "Libri",
        city: "Milano",
        contactInfo: "999999",
      },
    });
    expect(forbiddenEdit.status()).toBe(403);
  } finally {
    await outsiderContext.close();
  }

  await injectSessionCookies(page, request);
  await patchEmailVerified(page);
  await page.goto("/marketplace", { waitUntil: "load" });
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByTestId(`marketplace-edit-post-${original.id}`).click();
  await expect(page.getByRole("heading", { name: "Modifica annuncio" })).toBeVisible();
  await expect(page.getByText(/Foto dell'oggetto/)).toHaveCount(0);

  const updatedTitle = `Corrected listing ${RUN_ID}`;
  await page.getByPlaceholder(/Titolo/).fill(updatedTitle);
  await page.getByPlaceholder(/Descrizione/).fill("Corrected listing details.");
  await page.getByPlaceholder(/Prezzo/).fill("89");
  await page.getByRole("combobox").selectOption("Libri");
  await page.getByPlaceholder("Città").fill("Torino");
  await page.getByPlaceholder(/Telefono/).fill("222222");

  const updateResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(`/api/hub-posts/${original.id}/details`) && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Salva modifiche", exact: true }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.status(), await updateResponse.text()).toBe(200);
  await expect(page.getByText(updatedTitle, { exact: true })).toBeVisible();
  await expect(page.locator(`img[alt^="${updatedTitle}"]`)).toHaveCount(3);

  const refreshedPosts = (await (await request.get("/api/hub-posts?category=marketplace")).json()) as Array<{
    id: string;
    profileId: string;
    title: string;
    description: string;
    price: number | null;
    subcategory: string;
    city: string | null;
    contactInfo: string | null;
    imageUrl: string | null;
    imageUrls: string[];
  }>;
  const updated = refreshedPosts.find((post) => post.id === original.id);
  expect(updated).toMatchObject({
    id: original.id,
    profileId: sellerProfileId,
    title: updatedTitle,
    description: "Corrected listing details.",
    price: 89,
    subcategory: "Libri",
    city: "Torino",
    contactInfo: "222222",
    imageUrl: original.imageUrl,
    imageUrls: original.imageUrls,
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

  for (const foreignPhoto of [otherUserPhoto, otherMarketplacePhoto]) {
    const rejected = await request.post("/api/hub-posts", {
      data: {
        category: "marketplace",
        title: `Rejected foreign photo ${RUN_ID}`,
        description: "Photos owned by another account or legacy uploads cannot be attached.",
        imageUrls: [...images.slice(0, 2), foreignPhoto],
      },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toContain("Ricarica le foto mancanti");
    expect((await request.get(foreignPhoto)).status()).toBe(200);
  }

  const first = await createListing(`First deletion ${RUN_ID}`, images.slice(0, 3));
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