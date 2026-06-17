import type { ComponentType } from "react";
import { AdminShellPage } from "../pages/AdminShellPage";
import { AuthPage } from "../pages/AuthPage";
import { CreateRoomPage } from "../pages/CreateRoomPage";
import { DiscoverShellPage } from "../pages/DiscoverShellPage";
import { HomeShellPage } from "../pages/HomeShellPage";
import {
  CommunityGuidelinesPage,
  PrivacyPage,
  SupportPage,
  TermsPage
} from "../pages/PlatformContentPage";
import { ProfileSettingsPage } from "../pages/ProfileSettingsPage";
import { RoomShellPage } from "../pages/RoomShellPage";

export type RouteDefinition = {
  component: ComponentType<{ onNavigate: (path: string) => void }>;
  label: string;
  path: string;
  showInPrimaryNav?: boolean;
  title: string;
};

export const routes: RouteDefinition[] = [
  {
    component: HomeShellPage,
    label: "Home",
    path: "/",
    title: "Live rooms for shared YouTube moments"
  },
  {
    component: DiscoverShellPage,
    label: "Discover",
    path: "/discover",
    title: "Discover live rooms"
  },
  {
    component: CreateRoomPage,
    label: "Create",
    path: "/create-room",
    title: "Create a live room"
  },
  {
    component: RoomShellPage,
    label: "Room",
    path: "/room",
    title: "Live room"
  },
  {
    component: AuthPage,
    label: "Auth",
    path: "/auth",
    showInPrimaryNav: false,
    title: "Log in or sign up"
  },
  {
    component: AuthPage,
    label: "Reset password",
    path: "/auth/reset",
    showInPrimaryNav: false,
    title: "Reset your password"
  },
  {
    component: ProfileSettingsPage,
    label: "Profile",
    path: "/profile",
    title: "Profile and settings"
  },
  {
    component: AdminShellPage,
    label: "Admin",
    path: "/admin",
    showInPrimaryNav: false,
    title: "Admin control center"
  },
  {
    component: TermsPage,
    label: "Terms",
    path: "/terms",
    showInPrimaryNav: false,
    title: "Terms of Service"
  },
  {
    component: PrivacyPage,
    label: "Privacy",
    path: "/privacy",
    showInPrimaryNav: false,
    title: "Privacy Policy"
  },
  {
    component: CommunityGuidelinesPage,
    label: "Guidelines",
    path: "/community-guidelines",
    showInPrimaryNav: false,
    title: "Community Guidelines"
  },
  {
    component: SupportPage,
    label: "Support",
    path: "/support",
    showInPrimaryNav: false,
    title: "Support"
  }
];
