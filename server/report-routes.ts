import type { Express, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import {
  blogPosts,
  coldMessages,
  matches,
  messages,
  privateRoomMessages,
  profiles,
  reports,
  roomMessages,
  userSuspensions,
} from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import {
  getReportSuspensionExpiry,
  isBlogPostAuthoredByReportedUser,
  isChatMessageAuthoredByReportedUser,
  isColdMessageAuthoredByReportedUser,
  isRoomMessageAuthoredByReportedUser,
  isReportContentType,
} from "./report-moderation";
import { captureDetailedReportContentSnapshot } from "./report-content-evidence";
import {
  isDetailedReportContentType,
  moderateDetailedReportInTransaction,
} from "./report-moderation-actions";

type ReportNotification = (reportId: string) => void | Promise<unknown>;
type DisconnectReportedProfile = (profileId: string) => void;

export function registerAdminReportListRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  isAdmin: RequestHandler,
  getReports: () => Promise<unknown[]>,
): void {
  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      res.json(await getReports());
    } catch {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });
}

export function registerReportSubmissionRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  notifyAdminsOfNewUserReport: ReportNotification,
): void {
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const {
        reportedId,
        reason,
        description,
        coldMessageId,
        reportedContentType: requestedContentType,
        reportedContentId: requestedContentId,
      } = req.body;
      if (typeof reportedId !== "string" || !reportedId || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "reportedId and reason are required" });
      }
      if (reportedId === profile.id) {
        return res.status(400).json({ error: "You cannot report your own profile" });
      }
      if (coldMessageId !== undefined && typeof coldMessageId !== "string") {
        return res.status(400).json({ error: "coldMessageId must be a string" });
      }
      if (description !== undefined && typeof description !== "string") {
        return res.status(400).json({ error: "description must be a string" });
      }

      const reportedContentType = requestedContentType ?? (coldMessageId ? "cold_message" : undefined);
      const reportedContentId = requestedContentId ?? coldMessageId;
      if (reportedContentType !== undefined && !isReportContentType(reportedContentType)) {
        return res.status(400).json({ error: "Unsupported reported content type" });
      }
      if (
        (reportedContentType !== undefined && typeof reportedContentId !== "string") ||
        (reportedContentType === undefined && reportedContentId !== undefined) ||
        (reportedContentId !== undefined && typeof reportedContentId !== "string")
      ) {
        return res.status(400).json({ error: "A supported content type and content ID must be provided together" });
      }
      if (
        coldMessageId &&
        (reportedContentType !== "cold_message" || reportedContentId !== coldMessageId)
      ) {
        return res.status(400).json({ error: "Cold-message report reference does not match" });
      }

      let coldMessageContent: string | undefined;
      let reportedContentSnapshot: string | undefined;
      if (reportedContentType === "profile" && reportedContentId) {
        if (reportedContentId !== reportedId) {
          return res.status(400).json({ error: "Reported profile reference does not match the report target" });
        }
        const [reportedProfile] = await db
          .select({
            id: profiles.id,
            name: profiles.name,
            bio: profiles.bio,
            imageUrl: profiles.imageUrl,
            photos: profiles.photos,
            profileVideoUrl: profiles.profileVideoUrl,
          })
          .from(profiles)
          .where(eq(profiles.id, reportedContentId))
          .limit(1);
        if (!reportedProfile) return res.status(404).json({ error: "Reported profile not found" });
        reportedContentSnapshot = JSON.stringify(reportedProfile);
      } else if (reportedContentType === "chat_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: messages.id,
            matchId: messages.matchId,
            senderId: messages.senderId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.id, reportedContentId))
          .limit(1);
        const [match] = message
          ? await db
            .select({ profile1Id: matches.profile1Id, profile2Id: matches.profile2Id })
            .from(matches)
            .where(eq(matches.id, message.matchId))
            .limit(1)
          : [];
        if (!message || !isChatMessageAuthoredByReportedUser(
          { reporterId: profile.id, reportedId },
          message,
          match,
        )) {
          return res.status(400).json({ error: "Reported chat message does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify({
          content: message.content,
          createdAt: message.createdAt,
        });
      } else if (reportedContentType === "room_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: roomMessages.id,
            roomId: roomMessages.roomId,
            senderId: roomMessages.senderId,
            content: roomMessages.content,
            createdAt: roomMessages.createdAt,
          })
          .from(roomMessages)
          .where(eq(roomMessages.id, reportedContentId))
          .limit(1);
        if (!message || !isRoomMessageAuthoredByReportedUser({ reportedId }, message)) {
          return res.status(400).json({ error: "Reported room message does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify(message);
      } else if (reportedContentType === "private_room_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: privateRoomMessages.id,
            roomId: privateRoomMessages.roomId,
            senderId: privateRoomMessages.senderId,
            content: privateRoomMessages.content,
            createdAt: privateRoomMessages.createdAt,
          })
          .from(privateRoomMessages)
          .where(eq(privateRoomMessages.id, reportedContentId))
          .limit(1);
        if (!message || !isRoomMessageAuthoredByReportedUser({ reportedId }, message)) {
          return res.status(400).json({ error: "Reported private-room message does not belong to this report" });
        }
        if (!await storage.isPrivateRoomMember(message.roomId, profile.id)) {
          return res.status(403).json({ error: "You must be a member of this private room to report its messages" });
        }
        reportedContentSnapshot = JSON.stringify(message);
      } else if (reportedContentType === "blog_post" && reportedContentId) {
        const [post] = await db
          .select({
            id: blogPosts.id,
            profileId: blogPosts.profileId,
            title: blogPosts.title,
            content: blogPosts.content,
            imageUrl: blogPosts.imageUrl,
            category: blogPosts.category,
            createdAt: blogPosts.createdAt,
          })
          .from(blogPosts)
          .where(eq(blogPosts.id, reportedContentId))
          .limit(1);
        if (!post || !isBlogPostAuthoredByReportedUser({ reportedId }, post)) {
          return res.status(400).json({ error: "Reported blog post does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify(post);
      } else if (reportedContentType === "cold_message" && reportedContentId) {
        const [cm] = await db
          .select({
            id: coldMessages.id,
            content: coldMessages.content,
            fromProfileId: coldMessages.fromProfileId,
            toProfileId: coldMessages.toProfileId,
          })
          .from(coldMessages)
          .where(eq(coldMessages.id, reportedContentId))
          .limit(1);
        if (!cm || !isColdMessageAuthoredByReportedUser(
          { reporterId: profile.id, reportedId },
          cm,
        )) {
          return res.status(400).json({ error: "Reported cold message does not belong to this report" });
        }
        coldMessageContent = cm.content;
        reportedContentSnapshot = JSON.stringify({ content: cm.content });
      } else if (
        reportedContentType &&
        reportedContentId &&
        isDetailedReportContentType(reportedContentType)
      ) {
        reportedContentSnapshot = await captureDetailedReportContentSnapshot({
          reporterId: profile.id,
          reportedId,
          contentType: reportedContentType,
          contentId: reportedContentId,
        }) ?? undefined;
        if (!reportedContentSnapshot) {
          return res.status(400).json({ error: "Reported content does not belong to this report" });
        }
      }

      const report = await storage.createReport({
        reporterId: profile.id,
        reportedId,
        reason,
        description,
        coldMessageId: reportedContentType === "cold_message" ? reportedContentId : undefined,
        coldMessageContent,
        reportedContentType,
        reportedContentId,
        reportedContentSnapshot,
      });
      void notifyAdminsOfNewUserReport(report.id);
      res.json(report);
    } catch {
      res.status(500).json({ error: "Failed to create report" });
    }
  });
}


export function registerReportRemovalRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  isAdmin: RequestHandler,
  disconnectUserSockets: DisconnectReportedProfile,
): void {
  app.post("/api/admin/reports/:id/remove-and-suspend", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const moderatorUserId = req.user?.claims?.sub || req.session?.userId;
      if (!moderatorUserId) return res.status(401).json({ error: "Unauthorized" });
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .select()
          .from(reports)
          .where(eq(reports.id, req.params.id))
          .limit(1);

        if (!report) return { ok: false as const, error: "not_found" as const };
        if (report.status !== "pending") return { ok: false as const, error: "not_pending" as const };
        const contentType = isReportContentType(report.reportedContentType)
          ? report.reportedContentType
          : report.coldMessageId && !report.reportedContentType
            ? "cold_message"
            : null;
        const contentId = report.reportedContentId ?? report.coldMessageId;
        if (!contentType || !contentId) return { ok: false as const, error: "no_reported_content" as const };
        if (isDetailedReportContentType(contentType)) {
          return moderateDetailedReportInTransaction(tx, report, moderatorUserId, now);
        }

        let reportedUserId = report.reportedUserId;
        if (!reportedUserId) {
          const [reportedProfile] = await tx
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, report.reportedId))
            .limit(1);
          reportedUserId = reportedProfile?.userId ?? null;
        }
        const snapshotAvailable = Boolean(report.reportedContentSnapshot || report.coldMessageContent);
        let coldMessage:
          | { id: string; fromProfileId: string; toProfileId: string }
          | undefined;
        let chatMessage:
          | { id: string; matchId: string; senderId: string }
          | undefined;
        let roomMessage:
          | { id: string; roomId: string; senderId: string }
          | undefined;
        let privateRoomMessage:
          | { id: string; roomId: string; senderId: string }
          | undefined;
        let blogPost:
          | { id: string; profileId: string }
          | undefined;
        let profileExists = false;

        if (contentType === "cold_message") {
          if (report.coldMessageId && report.coldMessageId !== contentId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
          const [row] = await tx
            .select({
              id: coldMessages.id,
              fromProfileId: coldMessages.fromProfileId,
              toProfileId: coldMessages.toProfileId,
            })
            .from(coldMessages)
            .where(eq(coldMessages.id, contentId))
            .limit(1);
          coldMessage = row;
          if (coldMessage && !isColdMessageAuthoredByReportedUser(report, coldMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "chat_message") {
          const [row] = await tx
            .select({
              id: messages.id,
              matchId: messages.matchId,
              senderId: messages.senderId,
            })
            .from(messages)
            .where(eq(messages.id, contentId))
            .limit(1);
          chatMessage = row;
          if (chatMessage) {
            const [match] = await tx
              .select({ profile1Id: matches.profile1Id, profile2Id: matches.profile2Id })
              .from(matches)
              .where(eq(matches.id, chatMessage.matchId))
              .limit(1);
            if (!isChatMessageAuthoredByReportedUser(report, chatMessage, match)) {
              return { ok: false as const, error: "content_mismatch" as const };
            }
          }
        } else if (contentType === "room_message") {
          const [row] = await tx
            .select({
              id: roomMessages.id,
              roomId: roomMessages.roomId,
              senderId: roomMessages.senderId,
            })
            .from(roomMessages)
            .where(eq(roomMessages.id, contentId))
            .limit(1);
          roomMessage = row;
          if (roomMessage && !isRoomMessageAuthoredByReportedUser(report, roomMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "private_room_message") {
          const [row] = await tx
            .select({
              id: privateRoomMessages.id,
              roomId: privateRoomMessages.roomId,
              senderId: privateRoomMessages.senderId,
            })
            .from(privateRoomMessages)
            .where(eq(privateRoomMessages.id, contentId))
            .limit(1);
          privateRoomMessage = row;
          if (privateRoomMessage && !isRoomMessageAuthoredByReportedUser(report, privateRoomMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "blog_post") {
          const [row] = await tx
            .select({ id: blogPosts.id, profileId: blogPosts.profileId })
            .from(blogPosts)
            .where(eq(blogPosts.id, contentId))
            .limit(1);
          blogPost = row;
          if (blogPost && !isBlogPostAuthoredByReportedUser(report, blogPost)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "profile") {
          if (contentId !== report.reportedId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
          const [row] = await tx
            .select({ id: profiles.id, userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, contentId))
            .limit(1);
          profileExists = Boolean(row);
          if (row && reportedUserId && row.userId && row.userId !== reportedUserId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        }

        const linkedContentExists = Boolean(
          coldMessage || chatMessage || roomMessage || privateRoomMessage || blogPost || profileExists,
        );
        if (!linkedContentExists && !snapshotAvailable) {
          return { ok: false as const, error: "content_evidence_unavailable" as const };
        }

        const [claimedReport] = await tx
          .update(reports)
          .set({
            status: "resolved",
            resolvedAt: now,
            moderatedBy: moderatorUserId,
            moderatedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, "pending")))
          .returning({ id: reports.id });
        if (!claimedReport) return { ok: false as const, error: "not_pending" as const };

        let contentRemoved = false;
        let contentHidden = false;
        if (coldMessage) {
          const deletedMessages = await tx
            .delete(coldMessages)
            .where(and(
              eq(coldMessages.id, contentId),
              eq(coldMessages.fromProfileId, report.reportedId),
              eq(coldMessages.toProfileId, report.reporterId),
            ))
            .returning({ id: coldMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (chatMessage) {
          const deletedMessages = await tx
            .delete(messages)
            .where(and(
              eq(messages.id, contentId),
              eq(messages.senderId, report.reportedId),
              eq(messages.matchId, chatMessage.matchId),
            ))
            .returning({ id: messages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (roomMessage) {
          const deletedMessages = await tx
            .delete(roomMessages)
            .where(and(
              eq(roomMessages.id, contentId),
              eq(roomMessages.roomId, roomMessage.roomId),
              eq(roomMessages.senderId, report.reportedId),
            ))
            .returning({ id: roomMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (privateRoomMessage) {
          const deletedMessages = await tx
            .delete(privateRoomMessages)
            .where(and(
              eq(privateRoomMessages.id, contentId),
              eq(privateRoomMessages.roomId, privateRoomMessage.roomId),
              eq(privateRoomMessages.senderId, report.reportedId),
            ))
            .returning({ id: privateRoomMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (blogPost) {
          const deletedPosts = await tx
            .delete(blogPosts)
            .where(and(
              eq(blogPosts.id, contentId),
              eq(blogPosts.profileId, report.reportedId),
            ))
            .returning({ id: blogPosts.id });
          contentRemoved = deletedPosts.length > 0;
        } else if (contentType === "profile" && profileExists) {
          const hiddenProfiles = await tx
            .update(profiles)
            .set({ moderationHidden: true })
            .where(and(
              eq(profiles.id, contentId),
              eq(profiles.moderationHidden, false),
            ))
            .returning({ id: profiles.id });
          contentHidden = hiddenProfiles.length > 0;
        }

        await tx.update(reports)
          .set({
            moderationAction: `${contentRemoved
              ? `${contentType}_removed`
              : contentHidden
                ? "profile_hidden"
                : "content_already_removed"}${reportedUserId ? "_and_suspended" : ""}`,
          })
          .where(eq(reports.id, report.id));

        let expiresAt: Date | null = null;
        if (reportedUserId) {
          expiresAt = getReportSuspensionExpiry(now);
          await tx.insert(userSuspensions).values({
            userId: reportedUserId,
            reason: `Segnalazione ${report.id.slice(0, 8)}: ${report.reason}`.slice(0, 500),
            expiresAt,
            isPermanent: false,
          });
        }

        return {
          ok: true as const,
          targetProfileId: report.reportedId,
          contentRemoved,
          contentHidden,
          authorSuspended: Boolean(reportedUserId),
          expiresAt,
        };
      });

      if (!result.ok) {
        const responses = {
          not_found: [404, "Report not found"],
          not_pending: [409, "Report has already been handled"],
          no_reported_content: [409, "This report is not linked to a specific content item"],
          content_mismatch: [409, "Reported content does not belong to this report"],
          content_evidence_unavailable: [409, "Reported content and its evidence are unavailable"],
        } as const;
        const [status, error] = responses[result.error];
        return res.status(status).json({ error });
      }

      disconnectUserSockets(result.targetProfileId);
      console.warn(
        `[ugc-moderation] report=${req.params.id} contentRemoved=${result.contentRemoved} contentHidden=${result.contentHidden} ` +
        `authorSuspended=${result.authorSuspended} suspensionHours=${result.authorSuspended ? 24 : 0}`,
      );
      return res.json({
        success: true,
        contentRemoved: result.contentRemoved,
        contentHidden: result.contentHidden,
        contentWasAlreadyRemoved: !result.contentRemoved && !result.contentHidden,
        authorSuspended: result.authorSuspended,
        suspensionExpiresAt: result.expiresAt,
      });
    } catch (error) {
      console.error("[ugc-moderation] remove-and-suspend action failed:", error);
      return res.status(500).json({ error: "Failed to moderate reported content" });
    }
  });
}

export function registerReportSuspensionRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  isAdmin: RequestHandler,
  disconnectUserSockets: DisconnectReportedProfile,
): void {
  app.post("/api/admin/reports/:id/suspend-user", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const moderatorUserId = req.user?.claims?.sub || req.session?.userId;
      if (!moderatorUserId) return res.status(401).json({ error: "Unauthorized" });
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .select()
          .from(reports)
          .where(eq(reports.id, req.params.id))
          .limit(1);
        if (!report) return { ok: false as const, error: "not_found" as const };
        if (report.status !== "pending") return { ok: false as const, error: "not_pending" as const };
        if (report.reportedContentId || report.coldMessageId) {
          return { ok: false as const, error: "content_linked" as const };
        }

        let reportedUserId = report.reportedUserId;
        if (!reportedUserId) {
          const [reportedProfile] = await tx
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, report.reportedId))
            .limit(1);
          reportedUserId = reportedProfile?.userId ?? null;
        }
        if (!reportedUserId) return { ok: false as const, error: "no_account" as const };

        const [claimedReport] = await tx
          .update(reports)
          .set({
            status: "resolved",
            resolvedAt: now,
            moderationAction: "author_suspended",
            moderatedBy: moderatorUserId,
            moderatedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, "pending")))
          .returning({ id: reports.id });
        if (!claimedReport) return { ok: false as const, error: "not_pending" as const };

        const expiresAt = getReportSuspensionExpiry(now);
        await tx.insert(userSuspensions).values({
          userId: reportedUserId,
          reason: `Segnalazione ${report.id.slice(0, 8)}: ${report.reason}`.slice(0, 500),
          expiresAt,
          isPermanent: false,
        });
        return { ok: true as const, targetProfileId: report.reportedId, expiresAt };
      });

      if (!result.ok) {
        const responseMap = {
          not_found: [404, "Report not found"],
          not_pending: [409, "Report has already been handled"],
          content_linked: [409, "Remove the linked content through the report action"],
          no_account: [409, "The reported profile has no linked account to suspend"],
        } as const;
        const [status, error] = responseMap[result.error];
        return res.status(status).json({ error });
      }
      disconnectUserSockets(result.targetProfileId);
      return res.json({ success: true, authorSuspended: true, suspensionExpiresAt: result.expiresAt });
    } catch (error) {
      console.error("[ugc-moderation] report suspension failed:", error);
      return res.status(500).json({ error: "Failed to suspend reported user" });
    }
  });
}
