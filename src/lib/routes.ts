import type { ComponentType } from "react";
import { AdminShellPage } from "../pages/AdminShellPage";
import { AuthPage } from "../pages/AuthPage";
import { DiscoverShellPage } from "../pages/DiscoverShellPage";
import { HomeShellPage } from "../pages/HomeShellPage";
import { RoomShellPage } from "../pages/RoomShellPage";

export type RouteDefinition = {
  component: ComponentType<{ onNavigate: (path: string) => void }>;
  label: string;
  path: string;
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
    component: RoomShellPage,
    label: "Room",
    path: "/room",
    title: "Room shell"
  },
  {
    component: AuthPage,
    label: "Auth",
    path: "/auth",
    title: "Auth shell"
  },
  {
    component: AdminShellPage,
    label: "Admin",
    path: "/admin",
    title: "Admin shell"
  }
];
