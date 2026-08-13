import "../style.css";
import ClientRegistration from "./ClientRegistration";

export const metadata = {
  title: "Jembatan Timbang",
  description: "Aplikasi hybrid PWA untuk input dan sinkronisasi timbangan.",
};

export const viewport = {
  themeColor: "#0f4c81",
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <div id="root">
          <ClientRegistration />
          {children}
        </div>
      </body>
    </html>
  );
}
