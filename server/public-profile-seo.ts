export type PublicProfileSeoData = {
  id: string;
  name: string;
  age: number;
  imageUrl: string | null;
  location?: string | null;
  alienType?: string | null;
  profileVideoUrl?: string | null;
};

const SITE_ORIGIN = "https://vibraalienmatch.com";
const LANDING_VIDEO_URL = `${SITE_ORIGIN}/backgrounds/vibra-landing.mp4`;
const LANDING_VIDEO_THUMBNAIL_URL =
  `${SITE_ORIGIN}/images/vibra-landing-video-thumbnail.jpg`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function absoluteUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim(), SITE_ORIGIN);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function publicVideoUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("/objects/")) {
    return `${SITE_ORIGIN}/api/video-stream-object?path=${encodeURIComponent(trimmed)}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return `${SITE_ORIGIN}/api/video-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  return absoluteUrl(trimmed);
}

function setMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
): string {
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`;
  const matcher = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapeRegExp(key)}["'])[^>]*>`,
    "i",
  );

  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function removeMeta(html: string, attribute: "name" | "property", key: string): string {
  const matcher = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapeRegExp(key)}["'])[^>]*>\\s*`,
    "gi",
  );
  return html.replace(matcher, "");
}

export function renderLandingVideoSeoHtml(
  template: string,
  canonicalPath: "/" | "/landing" = "/",
): string {
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  let html = setMeta(
    template,
    "property",
    "og:image",
    LANDING_VIDEO_THUMBNAIL_URL,
  );
  html = setMeta(html, "name", "twitter:image", LANDING_VIDEO_THUMBNAIL_URL);
  html = setMeta(html, "property", "og:url", canonicalUrl);
  html = html.replace(
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  html = setMeta(html, "property", "og:video", LANDING_VIDEO_URL);
  html = setMeta(html, "property", "og:video:secure_url", LANDING_VIDEO_URL);
  html = setMeta(html, "property", "og:video:type", "video/mp4");
  html = setMeta(html, "property", "og:video:image", LANDING_VIDEO_THUMBNAIL_URL);
  html = setMeta(html, "property", "og:video:width", "640");
  html = setMeta(html, "property", "og:video:height", "640");
  return html;
}

export function renderPublicProfileSeoHtml(
  template: string,
  profile: PublicProfileSeoData,
): string {
  const canonicalUrl = `${SITE_ORIGIN}/p/${encodeURIComponent(profile.id)}`;
  const imageUrl = absoluteUrl(profile.imageUrl);
  const videoUrl = publicVideoUrl(profile.profileVideoUrl);
  const title = `${profile.name}, ${profile.age} — Vibra`;
  const description =
    `${profile.name}, ${profile.age} anni` +
    `${profile.location ? ` · ${profile.location}` : ""}` +
    `${profile.alienType ? ` · ${profile.alienType}` : ""}. Scopri il suo profilo su Vibra.`;

  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  for (const property of [
    "og:video",
    "og:video:secure_url",
    "og:video:image",
    "og:video:type",
    "og:video:width",
    "og:video:height",
  ]) {
    html = removeMeta(html, "property", property);
  }
  html = html.replace(
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:type", "profile");
  html = setMeta(html, "property", "og:url", canonicalUrl);
  html = setMeta(html, "property", "og:site_name", "Vibra");
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);

  if (imageUrl) {
    html = setMeta(html, "property", "og:image", imageUrl);
    html = setMeta(html, "property", "og:image:secure_url", imageUrl);
    html = setMeta(html, "property", "og:image:alt", `Foto profilo di ${profile.name}`);
    html = setMeta(html, "name", "twitter:image", imageUrl);
  } else {
    html = removeMeta(html, "property", "og:image");
    html = removeMeta(html, "property", "og:image:secure_url");
    html = removeMeta(html, "property", "og:image:alt");
    html = removeMeta(html, "name", "twitter:image");
  }

  if (videoUrl && imageUrl) {
    html = setMeta(html, "property", "og:video", videoUrl);
    html = setMeta(html, "property", "og:video:secure_url", videoUrl);
    html = setMeta(html, "property", "og:video:image", imageUrl);
    if (profile.profileVideoUrl?.startsWith("/objects/")) {
      html = setMeta(html, "property", "og:video:type", "video/mp4");
    }
  }

  return html;
}