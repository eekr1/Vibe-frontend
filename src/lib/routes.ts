import type { ComponentType } from "react";
import { AdminShellPage } from "../pages/AdminShellPage";
import { AuthPage } from "../pages/AuthPage";
import { CreateRoomPage } from "../pages/CreateRoomPage";
import { DiscoverShellPage } from "../pages/DiscoverShellPage";
import { HomeShellPage } from "../pages/HomeShellPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import {
  CommunityGuidelinesPage,
  PrivacyPage,
  SupportPage,
  TermsPage
} from "../pages/PlatformContentPage";
import { ProfileSettingsPage } from "../pages/ProfileSettingsPage";
import { MemberProfilePage } from "../pages/MemberProfilePage";
import { OwnerProfilePage } from "../pages/OwnerProfilePage";
import { RoomShellPage } from "../pages/RoomShellPage";
import { FriendsPage } from "../pages/FriendsPage";
import { MessagesPage } from "../pages/MessagesPage";

export type RouteDefinition = {
  component: ComponentType<{ onNavigate: (path: string) => void }>;
  label: string;
  path: string;
  shell: "admin" | "app" | "home" | "room" | "utility";
  showInPrimaryNav?: boolean;
  match?: (path: string) => boolean;
  title: string;
};

export const routes: RouteDefinition[] = [
  {
    component: HomeShellPage,
    label: "Home",
    path: "/",
    shell: "home",
    showInPrimaryNav: true,
    title: "Live rooms for shared YouTube moments"
  },
  {
    component: DiscoverShellPage,
    label: "Discover",
    path: "/discover",
    shell: "app",
    showInPrimaryNav: true,
    title: "Discover live rooms"
  },
  {
    component: CreateRoomPage,
    label: "Create room",
    path: "/create-room",
    shell: "app",
    showInPrimaryNav: true,
    title: "Create a live room"
  },
  {
    component: RoomShellPage,
    label: "Room",
    path: "/room",
    shell: "room",
    title: "Live room"
  },
  {
    component: FriendsPage,
    label: "Friends",
    path: "/friends",
    shell: "app",
    title: "Friends and requests"
  },
  {
    component: MessagesPage,
    label: "Messages",
    path: "/messages",
    shell: "app",
    title: "Direct messages"
  },
  {
    component: AuthPage,
    label: "Account",
    path: "/auth",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Log in or sign up"
  },
  {
    component: AuthPage,
    label: "Reset password",
    path: "/auth/reset",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Reset your password"
  },
  {
    component: OwnerProfilePage,
    label: "Profile",
    path: "/profile",
    shell: "app",
    title: "Your member profile"
  },
  {
    component: ProfileSettingsPage,
    label: "Settings",
    path: "/settings",
    shell: "app",
    title: "Profile, privacy, and account settings"
  },
  {
    component: MemberProfilePage,
    label: "Member profile",
    match: (path) => /^\/users\/[^/]+$/.test(path),
    path: "/users/:username",
    shell: "app",
    title: "Member profile"
  },
  {
    component: AdminShellPage,
    label: "Admin",
    path: "/admin",
    shell: "admin",
    showInPrimaryNav: false,
    title: "Admin control center"
  },
  {
    component: TermsPage,
    label: "Terms",
    path: "/terms",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Terms of Service"
  },
  {
    component: PrivacyPage,
    label: "Privacy",
    path: "/privacy",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Privacy Policy"
  },
  {
    component: CommunityGuidelinesPage,
    label: "Guidelines",
    path: "/community-guidelines",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Community Guidelines"
  },
  {
    component: SupportPage,
    label: "Support",
    path: "/support",
    shell: "utility",
    showInPrimaryNav: false,
    title: "Support"
  }
];

export const notFoundRoute: RouteDefinition = {
  component: NotFoundPage,
  label: "Not found",
  path: "*",
  shell: "utility",
  showInPrimaryNav: false,
  title: "Page not found"
};
