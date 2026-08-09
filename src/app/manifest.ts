import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aether Field Office",
    short_name: "Aether",
    description: "Mapping digital terrain, from interface to infrastructure.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f2e8",
    theme_color: "#f8f2e8",
  };
}
