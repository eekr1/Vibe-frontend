import { useEffect, useState } from "react";
import {
  getPublicPlatformContent,
  type PlatformContentPageKey,
  type PublicPlatformContent
} from "../content/contentApi";
import { ApiClientError } from "../lib/api";

type PlatformContentPageProps = {
  eyebrow: string;
  pageKey: PlatformContentPageKey;
};

const fallbackCopy: Record<PlatformContentPageKey, { body: string; title: string }> = {
  "community-guidelines": {
    body:
      "Vibehall is built for shared watching, live chat, and respectful room behavior. Harassment, hate, spam, impersonation, harmful content, and room disruption are not welcome.",
    title: "Community Guidelines"
  },
  privacy: {
    body:
      "Vibehall stores the account, room, chat, report, and moderation data needed to run a safe shared watching platform. The public policy will continue to become more detailed as the service grows.",
    title: "Privacy Policy"
  },
  support: {
    body:
      "Need help with Vibehall? Contact the platform operator with the account, room, or report context that explains what happened.",
    title: "Support"
  },
  terms: {
    body:
      "These terms explain the core Vibehall rules in plain language. Use the platform respectfully, do not abuse rooms or other members, and understand that the service will keep evolving as the community grows.",
    title: "Terms of Service"
  }
};

function ContentBody({ body }: { body: string }) {
  return (
    <>
      {body.split(/\n{2,}/).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </>
  );
}

export function PlatformContentPage({ eyebrow, pageKey }: PlatformContentPageProps) {
  const [content, setContent] = useState<PublicPlatformContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fallback = fallbackCopy[pageKey];

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await getPublicPlatformContent(pageKey);

        if (isMounted) {
          setContent(response.content);
        }
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof ApiClientError
            ? caughtError.message
            : "This page could not be loaded from platform content."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      isMounted = false;
    };
  }, [pageKey]);

  const pageTitle = content?.title ?? fallback.title;
  const pageBody = content?.body ?? fallback.body;

  return (
    <section className="surface-panel wide-panel content-page">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{pageTitle}</h2>
      {isLoading ? (
        <div className="inline-loading">
          <span className="loader" />
          Loading platform content
        </div>
      ) : null}
      {error ? (
        <p className="state-banner">
          Published content could not be reached right now, so Vibehall is showing the current platform copy.
        </p>
      ) : null}
      <ContentBody body={pageBody} />
      <p className="content-meta">
        {content?.publishedAt ? `Published ${new Date(content.publishedAt).toLocaleString()}` : "Current platform copy"}
      </p>
    </section>
  );
}

export function TermsPage() {
  return <PlatformContentPage eyebrow="Platform terms" pageKey="terms" />;
}

export function PrivacyPage() {
  return <PlatformContentPage eyebrow="Privacy" pageKey="privacy" />;
}

export function CommunityGuidelinesPage() {
  return <PlatformContentPage eyebrow="Community" pageKey="community-guidelines" />;
}

export function SupportPage() {
  return <PlatformContentPage eyebrow="Support" pageKey="support" />;
}
