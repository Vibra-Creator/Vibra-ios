import assert from "node:assert/strict";
import test from "node:test";
import {
  renderLandingVideoSeoHtml,
  renderPublicProfileSeoHtml,
} from "../public-profile-seo";

const template = `<!doctype html>
<html><head>
  <title>Vibra home</title>
  <meta name="description" content="Home description" />
  <link rel="canonical" href="https://vibraalienmatch.com/" />
  <meta property="og:title" content="Home" />
  <meta property="og:description" content="Home description" />
  <meta property="og:url" content="https://vibraalienmatch.com/" />
  <meta property="og:image" content="https://vibraalienmatch.com/home.jpg" />
  <meta property="og:video" content="https://vibraalienmatch.com/home.mp4" />
  <meta property="og:video:image" content="https://vibraalienmatch.com/home.jpg" />
  <meta name="twitter:image" content="https://vibraalienmatch.com/home.jpg" />
</head><body><div id="root"></div></body></html>`;

test("landing video metadata is emitted only when the public landing page is selected", () => {
  const html = renderLandingVideoSeoHtml(template);

  assert.match(html, /property="og:image" content="https:\/\/vibraalienmatch\.com\/images\/vibra-landing-video-thumbnail\.jpg"/);
  assert.match(html, /property="og:video:image" content="https:\/\/vibraalienmatch\.com\/images\/vibra-landing-video-thumbnail\.jpg"/);
  assert.match(html, /property="og:video" content="https:\/\/vibraalienmatch\.com\/backgrounds\/vibra-landing\.mp4"/);
  assert.match(html, /name="twitter:image" content="https:\/\/vibraalienmatch\.com\/images\/vibra-landing-video-thumbnail\.jpg"/);
  assert.match(html, /property="og:url" content="https:\/\/vibraalienmatch\.com\/"/);
  assert.match(html, /href="https:\/\/vibraalienmatch\.com\/"/);

  const landingHtml = renderLandingVideoSeoHtml(template, "/landing");
  assert.match(landingHtml, /property="og:url" content="https:\/\/vibraalienmatch\.com\/landing"/);
  assert.match(landingHtml, /href="https:\/\/vibraalienmatch\.com\/landing"/);
});

test("server-rendered public profile metadata includes its absolute video thumbnail", () => {
  const html = renderPublicProfileSeoHtml(template, {
    id: "profile-123",
    name: "Giulia",
    age: 28,
    imageUrl: "/objects/profile/photo.jpg",
    location: "Roma",
    alienType: "Stellare",
    profileVideoUrl: "/objects/profile/video.mp4",
  });

  assert.match(html, /<title>Giulia, 28 — Vibra<\/title>/);
  assert.match(html, /href="https:\/\/vibraalienmatch\.com\/p\/profile-123"/);
  assert.match(html, /property="og:image" content="https:\/\/vibraalienmatch\.com\/objects\/profile\/photo\.jpg"/);
  assert.match(html, /property="og:video:image" content="https:\/\/vibraalienmatch\.com\/objects\/profile\/photo\.jpg"/);
  assert.match(html, /property="og:video" content="https:\/\/vibraalienmatch\.com\/api\/video-stream-object\?path=%2Fobjects%2Fprofile%2Fvideo\.mp4"/);
  assert.doesNotMatch(html, /home\.mp4|home\.jpg/);
});

test("profiles without a video do not inherit the homepage video metadata", () => {
  const html = renderPublicProfileSeoHtml(template, {
    id: "profile-456",
    name: "Luca",
    age: 31,
    imageUrl: "https://cdn.example.test/luca.jpg",
  });

  assert.match(html, /property="og:image" content="https:\/\/cdn\.example\.test\/luca\.jpg"/);
  assert.doesNotMatch(html, /property="og:video/);
  assert.doesNotMatch(html, /home\.mp4|home\.jpg/);
});

test("profile metadata escapes untrusted text before inserting it into HTML", () => {
  const html = renderPublicProfileSeoHtml(template, {
    id: "profile-x",
    name: `A <script>alert("x")</script>`,
    age: 25,
    imageUrl: "/images/profile.jpg",
  });

  assert.match(html, /A &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<title>[^<]*<script>/);
});