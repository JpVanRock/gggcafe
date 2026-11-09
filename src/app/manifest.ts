import type { MetadataRoute } from "next";

/**
 * Makes the site installable as a phone app (Add to Home Screen on iPhone, Install app on
 * Android/Chrome). It opens full screen on /dashboard, which sends each account to its own home
 * (players /me, parents /family, mentors /mentor) and signed-out visitors to /login.
 * No service worker: nothing is stored on the phone for offline use, so player data stays behind
 * the sign-in. Icons: public/icons/ (maskable = the logo inside Android's 80% safe zone).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GGG.Cafe",
    short_name: "GGG.Cafe",
    description: "Softball player development and team management",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#000a2d",
    theme_color: "#000a2d",
    categories: ["sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
