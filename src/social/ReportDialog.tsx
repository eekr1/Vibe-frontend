import { useMemo, useRef, useState } from "react";
import { InlineError } from "../components/feedback";
import { Button, FormField, Modal, Select, Textarea } from "../components/ui";
import { ApiClientError } from "../lib/api";
import { submitReport, type ReportReason, type ReportTargetType } from "../rooms/roomApi";

type ReportDialogProps = {
  onBlock?: () => Promise<void>;
  onClose: () => void;
  onSubmitted?: () => void;
  targetId: string;
  targetLabel: string;
  targetType: Extract<ReportTargetType, "direct_message" | "profile" | "user">;
};

const reportReasons: Array<{ label: string; value: ReportReason }> = [
  { label: "Harassment or bullying", value: "harassment" },
  { label: "Hate speech", value: "hate_speech" },
  { label: "Spam or scam", value: "spam" },
  { label: "Abusive behavior", value: "abusive_behavior" },
  { label: "Harmful content", value: "harmful_content" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Other safety concern", value: "other" }
];

function describeReportError(error: unknown) {
  if (!(error instanceof ApiClientError)) {
    return "Report could not be submitted. Please try again.";
  }

  if (error.code === "STORAGE_UNAVAILABLE") {
    return "This report needs protected evidence storage, but storage is unavailable right now. Please retry shortly.";
  }

  if (error.code === "RATE_LIMITED") {
    return "Too many reports were submitted too quickly. Please wait a little and retry.";
  }

  if (["FORBIDDEN", "NOT_FOUND", "REPORT_TARGET_INVALID", "VALIDATION_FAILED"].includes(error.code)) {
    return "This report target is no longer available. Refresh and try again.";
  }

  return "Report could not be submitted. Please try again.";
}

export function ReportDialog({
  onBlock,
  onClose,
  onSubmitted,
  targetId,
  targetLabel,
  targetType
}: ReportDialogProps) {
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [submitted, setSubmitted] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const title = useMemo(() => {
    if (targetType === "direct_message") return "Report direct message";
    return `Report ${targetLabel}`;
  }, [targetLabel, targetType]);
  const trimmedDetails = details.trim();
  const detailsError = error === "Please add a short explanation for the safety team." ? error : null;

  async function submit() {
    if (!trimmedDetails) {
      setError("Please add a short explanation for the safety team.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await submitReport({ details: trimmedDetails, reason, targetId, targetType });
      setSubmitted(true);
      onSubmitted?.();
    } catch (caughtError) {
      setError(describeReportError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function blockAfterReport() {
    if (!onBlock || isBlocking) return;
    setError(null);
    setIsBlocking(true);

    try {
      await onBlock();
    } catch (caughtError) {
      setError("Block could not be completed. Please try again.");
    } finally {
      setIsBlocking(false);
    }
  }

  return (
    <Modal
      className="report-dialog-panel"
      descriptionId="report-dialog-description"
      dismissible={!isSubmitting && !isBlocking}
      initialFocusRef={titleRef}
      onClose={onClose}
      titleId="report-dialog-title"
    >
        <div className="report-dialog-header">
          <div>
            <p className="eyebrow">Safety report</p>
            <h3 id="report-dialog-title" ref={titleRef} tabIndex={-1}>{title}</h3>
          </div>
          <Button onClick={onClose} size="small" variant="text">
            Close
          </Button>
        </div>

        {submitted ? (
          <div className="report-confirmation">
            <h4>Report sent privately.</h4>
            <p id="report-dialog-description">
              Thanks for helping keep Vibehall safe. Blocking is separate, so you can choose it only if you want to
              stop future interaction.
            </p>
            <div className="report-dialog-actions">
              {onBlock ? (
                <Button loading={isBlocking} loadingLabel="Blocking this member" onClick={() => void blockAfterReport()} size="small" variant="danger">Block this member</Button>
              ) : null}
              <Button onClick={onClose} size="small" variant="primary">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <FormField label="Reason" required>
              <Select onChange={(event) => setReason(event.target.value as ReportReason)} value={reason}>
                {reportReasons.map((reportReason) => (
                  <option key={reportReason.value} value={reportReason.value}>
                    {reportReason.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField error={detailsError} hint="Plain text, up to 1000 characters." label="What happened?" required>
              <Textarea
                maxLength={1000}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Give the safety team enough context to review this report..."
                rows={5}
                value={details}
              />
            </FormField>
            <p className="report-dialog-count">{details.length}/1000</p>
            <p className="form-feedback compact" id="report-dialog-description">
              Reports are private. If this is a DM report, Vibehall captures protected evidence for moderator review.
            </p>
            <div className="report-dialog-actions">
              <Button disabled={isSubmitting} onClick={onClose} size="small">
                Cancel
              </Button>
              <Button loading={isSubmitting} loadingLabel="Submitting report" onClick={() => void submit()} size="small" variant="primary">Submit report</Button>
            </div>
          </>
        )}

        {error && error !== detailsError ? <InlineError className="compact" description={error} /> : null}
    </Modal>
  );
}
