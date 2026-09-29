import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function ChildSafety() {
  const [, setLocation] = useLocation();
  return (
    <div className="h-full overflow-y-auto p-6 bg-gradient-to-b from-background via-background to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/landing")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Child Safety Standards</h1>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6 text-muted-foreground">
            <section className="pb-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">CHILD SAFETY & CSAE PREVENTION POLICY – VIBRA APP</p>
              <p className="text-xs mt-1">Last updated: February 22, 2026</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Age Restriction</h2>
              <p>
                Vibra is a dating and social networking application intended exclusively for users aged 18 and older.
                Registration is strictly prohibited for anyone under the age of 18. During the registration process,
                users must confirm their date of birth, and any account found to belong to a minor will be immediately
                suspended and permanently deleted.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Zero Tolerance Policy</h2>
              <p>
                Vibra maintains a strict zero-tolerance policy toward any form of child sexual abuse and exploitation (CSAE).
                This includes, but is not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Any content depicting, promoting, or glorifying the sexual exploitation of minors</li>
                <li>Grooming behavior or attempts to establish inappropriate contact with minors</li>
                <li>Sharing, distributing, or soliciting child sexual abuse material (CSAM)</li>
                <li>Any communication that sexualizes minors in any way</li>
                <li>Attempts to circumvent age restrictions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Detection and Moderation</h2>
              <p className="mb-2">Vibra employs the following measures to prevent CSAE on the platform:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Age Verification</strong>: Mandatory date of birth verification at registration with 18+ requirement</li>
                <li><strong>Content Moderation</strong>: Active moderation of user profiles, photos, and messages by trained administrators</li>
                <li><strong>Automated Filtering</strong>: Banned word lists and automated content filters to detect inappropriate content</li>
                <li><strong>Profile Verification</strong>: Admin-verified profiles with visual badge to promote authenticity</li>
                <li><strong>Photo Review</strong>: All user-submitted photos (profile and challenge submissions) are reviewed by moderators</li>
                <li><strong>Chat Monitoring</strong>: Admin dashboard with access to private chat messages for moderation purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Reporting Mechanisms</h2>
              <p className="mb-2">
                Users can report suspicious or harmful behavior through the following channels:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>In-App Reporting</strong>: Users can report profiles directly from the app interface</li>
                <li><strong>Email</strong>: Reports can be sent to <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a></li>
                <li><strong>Block Function</strong>: Users can immediately block any other user</li>
              </ul>
              <p className="mt-3">
                All reports are reviewed by our moderation team within 24 hours. Reports involving potential CSAE
                are treated as highest priority and escalated immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Enforcement Actions</h2>
              <p className="mb-2">
                When CSAE-related content or behavior is detected, Vibra takes immediate action:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Immediate account suspension and permanent ban</li>
                <li>Deletion of all associated content</li>
                <li>Reporting to relevant law enforcement authorities (including NCMEC where applicable)</li>
                <li>Preservation of evidence for law enforcement cooperation</li>
                <li>Notification to relevant child protection agencies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Controller</h2>
              <p>
                The data controller responsible for the implementation of these safety standards is:
              </p>
              <div className="mt-2 pl-4 border-l-2 border-primary/30">
                <p className="font-medium text-foreground">Mattoni Fabio</p>
                <p>Email: <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a></p>
                <p>Location: Italy</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Compliance</h2>
              <p>
                Vibra is committed to complying with all applicable laws and regulations regarding the protection of minors,
                including but not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>EU General Data Protection Regulation (GDPR) – with specific attention to children's data (Art. 8)</li>
                <li>Italian Legislative Decree 196/2003 (Privacy Code)</li>
                <li>Applicable app-store child-safety policies</li>
                <li>Applicable national and international child protection laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Policy Updates</h2>
              <p>
                This policy is reviewed and updated regularly to ensure it reflects the latest best practices
                in child safety. Users will be notified of any significant changes through the app or via email.
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm text-center">
                For any concerns regarding child safety on Vibra, please contact us immediately at{" "}
                <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
