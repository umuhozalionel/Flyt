import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/shared/providers"
import { themeScript } from "@/components/shared/theme"
import en from "@/lib/i18n/en"
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
}

export const viewport: Viewport = {
  colorScheme: "light dark",
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
