import { useMemo, useState } from "react";
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

  return error.message;
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

  const title = useMemo(() => {
    if (targetType === "direct_message") return "Report direct message";
    return `Report ${targetLabel}`;
  }, [targetLabel, targetType]);
  const trimmedDetails = details.trim();

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
      setError(caughtError instanceof Error ? caughtError.message : "Block could not be completed. Please try again.");
    } finally {
      setIsBlocking(false);
    }
  }

  return (
    <div aria-modal="true" className="report-dialog-backdrop" role="dialog">
      <div className="report-dialog-panel">
        <div className="report-dialog-header">
          <div>
            <p className="eyebrow">Safety report</p>
            <h3>{title}</h3>
          </div>
          <button className="text-action compact" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {submitted ? (
          <div className="report-confirmation">
            <h4>Report sent privately.</h4>
            <p>
              Thanks for helping keep Vibehall safe. Blocking is separate, so you can choose it only if you want to
              stop future interaction.
            </p>
            <div className="report-dialog-actions">
              {onBlock ? (
                <button className="danger-action compact" disabled={isBlocking} onClick={() => void blockAfterReport()} type="button">
                  {isBlocking ? "Blocking..." : "Block this member"}
                </button>
              ) : null}
              <button className="primary-action compact" onClick={onClose} type="button">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label>
              Reason
              <select onChange={(event) => setReason(event.target.value as ReportReason)} value={reason}>
                {reportReasons.map((reportReason) => (
                  <option key={reportReason.value} value={reportReason.value}>
                    {reportReason.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What happened?
              <textarea
                maxLength={1000}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Give the safety team enough context to review this report..."
                rows={5}
                value={details}
              />
            </label>
            <p className="report-dialog-count">{details.length}/1000</p>
            <p className="form-feedback compact">
              Reports are private. If this is a DM report, Vibehall captures protected evidence for moderator review.
            </p>
            <div className="report-dialog-actions">
              <button className="secondary-action compact" disabled={isSubmitting} onClick={onClose} type="button">
                Cancel
              </button>
              <button className="primary-action compact" disabled={isSubmitting} onClick={() => void submit()} type="button">
                {isSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </>
        )}

        {error ? <p className="form-error compact" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
