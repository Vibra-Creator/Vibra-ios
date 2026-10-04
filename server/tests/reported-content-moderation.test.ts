import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  challengeSubmissions,
  cosmicSignals,
  dailyChallenges,
  events,
  hubPosts,
  profileVideos,
  profiles,
  reports,
  signalComments,
  signalLikes,
  stories,
  storyBriciole,
  storyVotes,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { runMigrations } from "../migrate.js";
import { captureDetailedReportContentSnapshot } from "../report-content-evidence.js";
import { moderateDetailedReportInTransaction } from "../report-moderation-actions.js";
import { DatabaseStorage } from "../storage.js";
import type { DetailedReportContentType } from "../report-content-evidence.js";

const storage = new DatabaseStorage();
const runId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createdProfileIds: string[] = [];
const createdReportIds: string[] = [];
const createdSignalIds: string[] = [];
const createdCommentIds: string[] = [];
const createdVideoIds: string[] = [];
const createdHubPostIds: string[] = [];
const createdEventIds: string[] = [];
const createdStoryIds: string[] = [];
const createdBriciolaIds: string[] = [];
const createdStoryVoteIds: string[] = [];
const createdChallengeIds: string[] = [];
const createdChallengeSubmissionIds: string[] = [];

async function createProfile(label: string, extras: Partial<typeof profiles.$inferInsert> = {}) {
  const [profile] = await db.insert(profiles).values({
    name: `__report_${label}_${runId}`,
    age: 30,
    bio: "",
    imageUrl: `https://example.test/${label}-avatar.jpg`,
    location: "",
    interests: [],
    alienType: "test",
    isBot: false,
    ...extras,
  }).returning({ id: profiles.id });
  createdProfileIds.push(profile.id);
  return profile.id;
}

async function createLinkedReport(input: {
  reporterId: string;
  reportedId: string;
  contentType: DetailedReportContentType;
  contentId: string;
}) {
  const snapshot = await captureDetailedReportContentSnapshot({
    reporterId: input.reporterId,
    reportedId: input.reportedId,
    contentType: input.contentType,
    contentId: input.contentId,
  });
  assert.ok(snapshot, `expected ${input.contentType} evidence to validate`);
  const report = await storage.createReport({
    reporterId: input.reporterId,
    reportedId: input.reportedId,
    reason: "Contenuto inappropriato",
    reportedContentType: input.contentType,
    reportedContentId: input.contentId,
    reportedContentSnapshot: snapshot,
  });
  createdReportIds.push(report.id);
  return report;
}

before(async () => {
  await runMigrations();
});

after(async () => {
  if (createdReportIds.length) {
    await db.delete(reports).where(inArray(reports.id, createdReportIds));
  }
  if (createdCommentIds.length) {
    await db.delete(signalComments).where(inArray(signalComments.id, createdCommentIds));
  }
  if (createdSignalIds.length) {
    await db.delete(signalLikes).where(inArray(signalLikes.signalId, createdSignalIds));
    await db.delete(signalComments).where(inArray(signalComments.signalId, createdSignalIds));
    await db.delete(cosmicSignals).where(inArray(cosmicSignals.id, createdSignalIds));
  }
  if (createdVideoIds.length) {
    await db.delete(profileVideos).where(inArray(profileVideos.id, createdVideoIds));
  }
  if (createdStoryVoteIds.length) {
    await db.delete(storyVotes).where(inArray(storyVotes.id, createdStoryVoteIds));
  }
  if (createdBriciolaIds.length) {
    await db.delete(storyBriciole).where(inArray(storyBriciole.id, createdBriciolaIds));
  }
  if (createdStoryIds.length) {
    await db.delete(stories).where(inArray(stories.id, createdStoryIds));
  }
  if (createdChallengeSubmissionIds.length) {
    await db.delete(challengeSubmissions).where(inArray(challengeSubmissions.id, createdChallengeSubmissionIds));
  }
  if (createdChallengeIds.length) {
    await db.delete(dailyChallenges).where(inArray(dailyChallenges.id, createdChallengeIds));
  }
  if (createdHubPostIds.length) {
    await db.delete(hubPosts).where(inArray(hubPosts.id, createdHubPostIds));
  }
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  if (createdProfileIds.length) {
    await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
  }
});

test("report review preserves exact evidence, removes the item, and records the moderator action", async () => {
  const reporterId = await createProfile("reporter");
  const authorId = await createProfile("author", {
    photos: ["https://example.test/keep.jpg", "https://example.test/flagged.jpg"],
    profileVideoUrl: "https://example.test/main-video.mp4",
  });
  const unrelatedAuthorId = await createProfile("other");

  const [profileVideo] = await db.insert(profileVideos).values({
    profileId: authorId,
    videoUrl: `https://example.test/video-${runId}.mp4`,
    caption: "Profile video",
  }).returning({ id: profileVideos.id });
  createdVideoIds.push(profileVideo.id);

  const [signal] = await db.insert(cosmicSignals).values({
    profileId: authorId,
    content: "Reported post",
    mediaUrl: `https://example.test/signal-${runId}.jpg`,
    mediaType: "image",
  }).returning({ id: cosmicSignals.id });
  createdSignalIds.push(signal.id);
  const [signalComment] = await db.insert(signalComments).values({
    signalId: signal.id,
    profileId: authorId,
    content: "Reported comment",
  }).returning({ id: signalComments.id });
  createdCommentIds.push(signalComment.id);
  await db.insert(signalLikes).values({ signalId: signal.id, profileId: reporterId });

  const [otherSignal] = await db.insert(cosmicSignals).values({
    profileId: unrelatedAuthorId,
    content: "Keep this unrelated post",
  }).returning({ id: cosmicSignals.id });
  createdSignalIds.push(otherSignal.id);
  const [targetedComment] = await db.insert(signalComments).values({
    signalId: otherSignal.id,
    profileId: authorId,
    content: "Only this comment should be removed",
  }).returning({ id: signalComments.id });
  createdCommentIds.push(targetedComment.id);

  const reportInputs = [
    {
      reporterId,
      reportedId: authorId,
      contentType: "profile_photo" as const,
      contentId: "https://example.test/flagged.jpg",
    },
    {
      reporterId,
      reportedId: authorId,
      contentType: "profile_video" as const,
      contentId: profileVideo.id,
    },
    {
      reporterId,
      reportedId: authorId,
      contentType: "profile_main_video" as const,
      contentId: authorId,
    },
    {
      reporterId,
      reportedId: authorId,
      contentType: "cosmic_signal" as const,
      contentId: signal.id,
    },
    {
      reporterId,
      reportedId: authorId,
      contentType: "signal_comment" as const,
      contentId: targetedComment.id,
    },
  ];

  const reportsForReview = [];
  for (const input of reportInputs) reportsForReview.push(await createLinkedReport(input));

  const pendingReports = await storage.getReports();
  for (const report of reportsForReview) {
    const reviewItem = pendingReports.find((candidate) => candidate.id === report.id);
    assert.equal(reviewItem?.status, "pending");
    assert.equal(reviewItem?.reportedContentType, report.reportedContentType);
    assert.equal(reviewItem?.reportedContentId, report.reportedContentId);
    assert.ok(reviewItem?.reportedContentSnapshot);
  }

  for (const report of reportsForReview) {
    const result = await db.transaction((tx) =>
      moderateDetailedReportInTransaction(tx, report, "test-moderator", new Date("2026-09-30T12:00:00Z")),
    );
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.contentRemoved, true);

    const [reviewed] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    assert.equal(reviewed.status, "resolved");
    assert.equal(reviewed.moderatedBy, "test-moderator");
    assert.equal(reviewed.moderatedAt?.toISOString(), "2026-09-30T12:00:00.000Z");
    assert.ok(reviewed.moderationAction?.endsWith("_removed"));
    assert.ok(reviewed.reportedContentSnapshot, "resolution must retain the submitted evidence");
  }

  const [updatedAuthor] = await db.select().from(profiles).where(eq(profiles.id, authorId)).limit(1);
  assert.deepEqual(updatedAuthor.photos, ["https://example.test/keep.jpg"]);
  assert.equal(updatedAuthor.profileVideoUrl, null);
  assert.equal((await storage.getProfileVideos(authorId)).some((video) => video.id === profileVideo.id), false);
  assert.equal((await storage.getSignalsFeed(reporterId)).some((item) => item.id === signal.id), false);
  assert.equal((await storage.getSignalComments(signal.id)).length, 0);
  assert.equal((await storage.getSignalsFeed(reporterId)).some((item) => item.id === otherSignal.id), true);
  assert.equal((await storage.getSignalComments(otherSignal.id)).some((item) => item.id === targetedComment.id), false);
});

test("report submission evidence rejects another person's media and private signals", async () => {
  const reporterId = await createProfile("evidence-reporter");
  const authorId = await createProfile("evidence-author", {
    photos: ["https://example.test/author-photo.jpg"],
  });
  const otherAuthorId = await createProfile("evidence-other-author");
  const [privateSignal] = await db.insert(cosmicSignals).values({
    profileId: otherAuthorId,
    toProfileId: otherAuthorId,
    content: "Not visible to the reporter",
  }).returning({ id: cosmicSignals.id });
  createdSignalIds.push(privateSignal.id);

  assert.equal(await captureDetailedReportContentSnapshot({
    reporterId,
    reportedId: otherAuthorId,
    contentType: "profile_photo",
    contentId: "https://example.test/author-photo.jpg",
  }), null);
  assert.equal(await captureDetailedReportContentSnapshot({
    reporterId,
    reportedId: otherAuthorId,
    contentType: "cosmic_signal",
    contentId: privateSignal.id,
  }), null);
  assert.equal(await captureDetailedReportContentSnapshot({
    reporterId,
    reportedId: authorId,
    contentType: "profile_photo",
    contentId: "https://example.test/not-on-profile.jpg",
  }), null);
});

test("remaining public feed reports verify authors, remove exact items, and preserve moderation evidence", async () => {
  const reporterId = await createProfile("remaining-reporter");
  const authorId = await createProfile("remaining-author");
  const unrelatedAuthorId = await createProfile("remaining-other");

  const [post] = await db.insert(hubPosts).values({
    id: `test-hub-post-${runId}`,
    profileId: authorId,
    profileName: "Reported author",
    profileImageUrl: "/images/test.png",
    category: "casa",
    title: `Reported listing ${runId}`,
    description: "Listing to remove",
  }).returning({ id: hubPosts.id });
  createdHubPostIds.push(post.id);

  const [event] = await db.insert(events).values({
    id: `test-event-${runId}`,
    profileId: authorId,
    profileName: "Reported author",
    profileImageUrl: "/images/test.png",
    city: "Torino",
    eventType: "community",
    title: `Reported event ${runId}`,
    description: "Event to remove",
    eventDate: "2099-01-01",
  }).returning({ id: events.id });
  createdEventIds.push(event.id);

  const [story] = await db.insert(stories).values({
    id: `test-story-${runId}`,
    theme: `Reported story ${runId}`,
  }).returning({ id: stories.id });
  createdStoryIds.push(story.id);
  const [briciola] = await db.insert(storyBriciole).values({
    id: `test-briciola-${runId}`,
    storyId: story.id,
    profileId: authorId,
    content: "Reported story contribution",
    mediaUrl: `https://example.test/story-${runId}.jpg`,
  }).returning({ id: storyBriciole.id });
  createdBriciolaIds.push(briciola.id);
  const [storyVote] = await db.insert(storyVotes).values({
    id: `test-story-vote-${runId}`,
    briolaId: briciola.id,
    profileId: reporterId,
    voteType: "up",
  }).returning({ id: storyVotes.id });
  createdStoryVoteIds.push(storyVote.id);

  const [challenge] = await db.insert(dailyChallenges).values({
    id: `test-challenge-${runId}`,
    title: `Reported challenge ${runId}`,
    description: "Challenge with an approved public photo",
    isActive: true,
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  }).returning({ id: dailyChallenges.id });
  createdChallengeIds.push(challenge.id);
  const [submission] = await db.insert(challengeSubmissions).values({
    id: `test-challenge-submission-${runId}`,
    challengeId: challenge.id,
    profileId: authorId,
    imageUrl: `https://example.test/challenge-${runId}.jpg`,
    status: "approved",
  }).returning({ id: challengeSubmissions.id });
  createdChallengeSubmissionIds.push(submission.id);

  const reportInputs = [
    { contentType: "hub_post" as const, contentId: post.id },
    { contentType: "event" as const, contentId: event.id },
    { contentType: "story_briciola" as const, contentId: briciola.id },
    { contentType: "challenge_submission" as const, contentId: submission.id },
  ];

  const reportsForReview = [];
  for (const input of reportInputs) {
    const validSnapshot = await captureDetailedReportContentSnapshot({
      reporterId,
      reportedId: authorId,
      ...input,
    });
    assert.ok(validSnapshot, `${input.contentType} should produce an author-verified snapshot`);
    assert.equal(await captureDetailedReportContentSnapshot({
      reporterId,
      reportedId: unrelatedAuthorId,
      ...input,
    }), null, `${input.contentType} must reject a forged report author`);

    const forgedReport = await storage.createReport({
      reporterId,
      reportedId: unrelatedAuthorId,
      reason: "Forged ownership test",
      reportedContentType: input.contentType,
      reportedContentId: input.contentId,
      reportedContentSnapshot: validSnapshot,
    });
    createdReportIds.push(forgedReport.id);
    const forgedResult = await db.transaction((tx) =>
      moderateDetailedReportInTransaction(tx, forgedReport, "test-moderator", new Date("2026-09-30T12:00:00Z")),
    );
    assert.deepEqual(forgedResult, { ok: false, error: "content_mismatch" });
    const [stillPending] = await db.select().from(reports).where(eq(reports.id, forgedReport.id)).limit(1);
    assert.equal(stillPending.status, "pending", "a forged report must not be resolved");

    const report = await createLinkedReport({
      reporterId,
      reportedId: authorId,
      ...input,
    });
    assert.ok(report.reportedContentSnapshot);
    reportsForReview.push(report);
  }

  assert.equal((await db.select().from(hubPosts).where(eq(hubPosts.id, post.id))).length, 1);
  assert.equal((await db.select().from(events).where(eq(events.id, event.id))).length, 1);
  assert.equal((await storage.getStoryBriciole(story.id)).some((item) => item.id === briciola.id), true);
  assert.equal((await storage.getApprovedChallengeGallery()).some((item) => item.id === submission.id), true);

  for (const report of reportsForReview) {
    const result = await db.transaction((tx) =>
      moderateDetailedReportInTransaction(tx, report, "test-moderator", new Date("2026-09-30T12:00:00Z")),
    );
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.contentRemoved, true);
    const [reviewed] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    assert.equal(reviewed.status, "resolved");
    assert.equal(reviewed.moderatedBy, "test-moderator");
    assert.equal(reviewed.moderatedAt?.toISOString(), "2026-09-30T12:00:00.000Z");
    assert.equal(reviewed.moderationAction, `${report.reportedContentType}_removed`);
    assert.ok(reviewed.reportedContentSnapshot, "moderation must retain the exact item evidence");
  }

  assert.equal((await db.select().from(hubPosts).where(eq(hubPosts.id, post.id))).length, 0);
  assert.equal((await db.select().from(events).where(eq(events.id, event.id))).length, 0);
  assert.equal((await storage.getStoryBriciole(story.id)).some((item) => item.id === briciola.id), false);
  assert.equal((await db.select().from(storyVotes).where(eq(storyVotes.id, storyVote.id))).length, 0);
  assert.equal((await storage.getApprovedChallengeGallery()).some((item) => item.id === submission.id), false);
});