import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scorely — live scoring for every game",
    short_name: "Scorely",
    description: "Score cricket, football, tennis, badminton, chess and more — and share it live.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080b10",
    theme_color: "#047857",
    categories: ["sports", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
