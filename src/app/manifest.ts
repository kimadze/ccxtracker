import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crypto Collective X",
    short_name: "CCX",
    description: "კრიპტო პორტფელის მონიტორინგი, ანალიტიკა და დაგეგმვა.",
    start_url: "/portfolios",
    scope: "/",
    display: "standalone",
    background_color: "#0c0d12",
    theme_color: "#0c0d12",
    lang: "ka",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/ccx-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/ccx-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
