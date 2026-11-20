import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/shared/providers"
import { themeScript } from "@/components/shared/theme"
import en from "@/lib/i18n/en"
import "@fontsource-variable/inter"
import "./globals.css"

export const metadata: Metadata = {
  title: en["meta.title"],
  description: en["meta.description"],
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  // Installed on a phone's home screen: full screen, with the Flyt name.
  appleWebApp: { capable: true, title: "Flyt", statusBarStyle: "default" },
  applicationName: "Flyt",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf6" },
    { media: "(prefers-color-scheme: dark)", color: "#202923" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
