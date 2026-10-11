import type { MetadataRoute } from "next";

// PWA manifest: after "Add to Home Screen" the site opens full-screen like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Home-screen app name, bilingual on purpose (Chinese + English)
    name: "StudyBuds",
    short_name: "StudyBuds",
    description: "按课程、时间、学习风格匹配学习搭子 · Find study buddies by course, schedule and style",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#5b5bd6",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
