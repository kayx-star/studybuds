import type { MetadataRoute } from "next";

// PWA 清单：手机浏览器“添加到主屏幕”后像 App 一样全屏打开
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "学习搭子 Study Buddy",
    short_name: "学习搭子",
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
