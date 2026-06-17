import { apiRequest } from "../lib/api";

export type PlatformContentPageKey = "community-guidelines" | "privacy" | "support" | "terms";

export type PublicPlatformContent = {
  body: string;
  pageKey: PlatformContentPageKey;
  publishedAt: string | null;
  title: string;
  updatedAt: string;
};

export function getPublicPlatformContent(pageKey: PlatformContentPageKey) {
  return apiRequest<{ content: PublicPlatformContent }>(`/content/${pageKey}`);
}
