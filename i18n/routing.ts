import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "as-needed",
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
});
