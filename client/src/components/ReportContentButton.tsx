import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { hideBlockedProfileFromFeeds } from "@/lib/block-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const REPORT_REASONS = [
  "Contenuto inappropriato",
  "Truffa o informazione ingannevole",
  "Molestie o contenuto offensivo",
  "Altro",
];

interface ReportContentButtonProps {
  reportedId: string;
  contentType: "hub_post" | "event" | "story_briciola" | "challenge_submission";
  contentId: string;
  currentProfileId?: string;
  className?: string;
}

export function ReportContentButton({
  reportedId,
  contentType,
  contentId,
  currentProfileId,
  className,
}: ReportContentButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [description, setDescription] = useState("");

  const reportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reports", {
      reportedId,
      reason,
      description: description.trim() || undefined,
      reportedContentType: contentType,
      reportedContentId: contentId,
    }),
    onSuccess: () => {
      setOpen(false);
      setReason(REPORT_REASONS[0]);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/reports/mine"] });
      toast({ title: "Segnalazione inviata", description: "Il team di moderazione verificherà questo contenuto." });
    },
    onError: (error: Error) => {
      toast({ title: "Segnalazione non inviata", description: error.message, variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/block", { blockedId: reportedId }),
    onSuccess: () => {
      setOpen(false);
      setReason(REPORT_REASONS[0]);
      setDescription("");
      hideBlockedProfileFromFeeds(reportedId);
      toast({
        title: "Utente bloccato",
        description: "I suoi contenuti non verranno più mostrati nei tuoi feed.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Blocco non riuscito", description: error.message, variant: "destructive" });
    },
  });

  if (!currentProfileId || currentProfileId === reportedId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={className}
          data-testid={`button-report-${contentType}-${contentId}`}
        >
          <Flag className="mr-1 h-3.5 w-3.5" />
          Segnala
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segnala questo contenuto</DialogTitle>
          <DialogDescription>
            La segnalazione includerà il contenuto esatto e il suo autore per la revisione. Puoi anche bloccare l'autore per nascondere i suoi contenuti.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5 text-sm font-medium">
          Motivo
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid={`select-report-reason-${contentType}-${contentId}`}
          >
            {REPORT_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Aggiungi dettagli utili (facoltativo)"
          maxLength={1000}
          rows={3}
          data-testid={`input-report-description-${contentType}-${contentId}`}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={blockMutation.isPending || reportMutation.isPending}
            onClick={() => {
              if (window.confirm("Bloccare questo utente? Non vedrai più i suoi contenuti nei tuoi feed.")) {
                blockMutation.mutate();
              }
            }}
            data-testid={`button-block-author-${contentType}-${contentId}`}
          >
            {blockMutation.isPending ? "Blocco…" : "Blocca autore"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={reportMutation.isPending || blockMutation.isPending || !reason.trim()}
            onClick={() => reportMutation.mutate()}
            data-testid={`button-submit-report-${contentType}-${contentId}`}
          >
            {reportMutation.isPending ? "Invio…" : "Invia segnalazione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}