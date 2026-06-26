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

type ContentBlock =
  | { id: string; kind: "heading"; text: string }
  | { id: string; items: string[]; kind: "list" }
  | { id: string; kind: "paragraph"; text: string };

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

const pageDetails: Record<PlatformContentPageKey, { intro: string; trustNote: string }> = {
  "community-guidelines": {
    intro: "Rules for keeping shared rooms readable, respectful, and safe enough to enjoy live together.",
    trustNote: "Reports and host actions are part of Vibehall's real safety model, not decorative controls."
  },
  privacy: {
    intro: "A calm public summary of the platform data practices that support accounts, rooms, chat, reports, and safety.",
    trustNote: "Privacy content is published by an admin-managed trust workflow; draft details stay private."
  },
  support: {
    intro: "Help guidance for account, room, access, safety, and report situations using the support content currently published by the platform.",
    trustNote: "Vibehall does not promise live support here; this page uses the currently published support guidance."
  },
  terms: {
    intro: "The public service rules for using Vibehall's member-based shared room experience.",
    trustNote: "These pages are product-facing trust content and still need real legal review before formal launch."
  }
};

function parseContentBlocks(body: string) {
  const blocks: ContentBlock[] = [];
  const pendingListItems: string[] = [];

  function flushList() {
    if (pendingListItems.length === 0) {
      return;
    }

    blocks.push({
      id: `list-${blocks.length}`,
      items: [...pendingListItems],
      kind: "list"
    });
    pendingListItems.length = 0;
  }

  body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const listItem = line.match(/^[-*]\s+(.+)$/);

      if (heading) {
        flushList();
        blocks.push({ id: `heading-${blocks.length}`, kind: "heading", text: heading[1] });
        return;
      }

      if (listItem) {
        pendingListItems.push(listItem[1]);
        return;
      }

      flushList();
      blocks.push({ id: `paragraph-${blocks.length}`, kind: "paragraph", text: line });
    });

  flushList();

  return blocks.length > 0 ? blocks : [{ id: "empty-copy", kind: "paragraph", text: body } satisfies ContentBlock];
}

function ContentBody({ body }: { body: string }) {
  const blocks = parseContentBlocks(body);

  return (
    <div className="content-body">
      {blocks.map((block) => {
        if (block.kind === "heading") {
          return <h3 key={block.id}>{block.text}</h3>;
        }

        if (block.kind === "list") {
          return (
            <ul key={block.id}>
              {block.items.map((item, index) => (
                <li key={`${block.id}-${index}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={block.id}>{block.text}</p>;
      })}
    </div>
  );
}

function formatPublishedAt(value: string | null) {
  if (!value) {
    return "Current platform copy";
  }

  return `Published ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))}`;
}

function describeContentError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "PLATFORM_CONTENT_NOT_PUBLISHED" || error.code === "NOT_FOUND") {
      return "The published version of this page is not available yet. Vibehall is showing the current public fallback copy without exposing drafts.";
    }

    return "Published content could not be reached right now. Vibehall is showing the current public fallback copy while the platform content service recovers.";
  }

  return "Vibehall could not reach the platform content service. You can retry, or keep reading the current public fallback copy below.";
}

export function PlatformContentPage({ eyebrow, pageKey }: PlatformContentPageProps) {
  const [content, setContent] = useState<PublicPlatformContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadToken, setLoadToken] = useState(0);
  const fallback = fallbackCopy[pageKey];
  const detail = pageDetails[pageKey];

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

        setContent(null);
        setError(describeContentError(caughtError));
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
  }, [loadToken, pageKey]);

  const pageTitle = content?.title ?? fallback.title;
  const pageBody = content?.body ?? fallback.body;
  const isFallback = !content;

  return (
    <section className="trust-content-page" aria-busy={isLoading}>
      <header className="trust-content-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{pageTitle}</h2>
          <p>{detail.intro}</p>
        </div>
        <aside className="trust-content-status" aria-label="Trust content status">
          <span className={isFallback ? "ui-badge" : "ui-badge is-success"}>
            {isFallback ? "Fallback copy" : "Published content"}
          </span>
          <span>{formatPublishedAt(content?.publishedAt ?? null)}</span>
        </aside>
      </header>

      {isLoading ? (
        <div className="inline-loading">
          <span className="loader" />
          Loading published platform content
        </div>
      ) : null}

      {error ? (
        <div className="state-banner trust-content-alert">
          <p>{error}</p>
          <button className="secondary-action compact" onClick={() => setLoadToken((token) => token + 1)} type="button">
            Retry content
          </button>
        </div>
      ) : null}

      <article className="surface-panel content-page trust-content-card">
        <ContentBody body={pageBody} />
        <footer className="content-meta">
          <span>{formatPublishedAt(content?.publishedAt ?? null)}</span>
          <span>{detail.trustNote}</span>
        </footer>
      </article>
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

