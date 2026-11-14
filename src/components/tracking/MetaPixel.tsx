"use client";

// Meta Pixel for the plans pages: base code + a PageView per navigation.
// Renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set (see lib/meta-pixel).

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, metaTrack } from "@/lib/meta-pixel";

export default function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    // The base code fires the first PageView; later client navigations fire their own.
    if ((window as unknown as { __snPixelFirst?: boolean }).__snPixelFirst) metaTrack("PageView");
    (window as unknown as { __snPixelFirst?: boolean }).__snPixelFirst = true;
  }, [pathname]);

  if (!/^\d{6,20}$/.test(META_PIXEL_ID)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  );
}
