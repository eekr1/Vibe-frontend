import type { ComponentType } from "react";
import { AdminShellPage } from "../pages/AdminShellPage";
import { AuthPage } from "../pages/AuthPage";
import { CreateRoomPage } from "../pages/CreateRoomPage";
import { DiscoverShellPage } from "../pages/DiscoverShellPage";
import { HomeShellPage } from "../pages/HomeShellPage";
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
    title: "A calm live video room foundation"
  },
  {
    component: DiscoverShellPage,
    label: "Discover",
    path: "/discover",
    title: "Discover shell"
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
    title: "Room shell"
  },
  {
    component: AuthPage,
    label: "Auth",
    path: "/auth",
    showInPrimaryNav: false,
    title: "Auth shell"
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
    title: "Admin shell"
  }
];
