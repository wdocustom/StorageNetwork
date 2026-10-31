import { getAppUrl } from "@/lib/url-helper";

export function masterEmailLayout(title: string, body: string): string {
  const logoUrl = `${getAppUrl()}/landing_page_logo.png`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- The design is already dark: tell mail apps not to "dark-mode" it.
       Without this, Outlook (iOS/Android/Mac) and Gmail invert it to a
       white background with dark gold text. -->
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
  </style>
  <title>${title}</title>
</head>
<body bgcolor="#000000" style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#000000;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;"><tr><td>
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;background-color:#000000;">

    <!-- Header -->
    <div style="text-align:center;padding:0 0 32px;">
      <img src="${logoUrl}" alt="Storage Network" style="color:#facc15;font-weight:800;max-width:100px;max-height:100px;width:auto;height:auto;margin-bottom:16px;" />
      <h1 style="margin:0;color:#facc15;font-size:22px;font-weight:800;letter-spacing:-0.3px;">${title}</h1>
      <div style="margin:12px auto 0;width:40px;height:2px;background:#facc15;border-radius:1px;"></div>
    </div>

    <!-- Body -->
    ${body}

    <!-- Footer -->
    <div style="border-top:1px solid #222;padding:20px 0 0;text-align:center;">
      <p style="margin:0;color:#333;font-size:11px;">
        Sent by <a href="${getAppUrl()}" style="color:#555;text-decoration:none;font-weight:600;">Storage Network</a> &bull; storage-network.app
      </p>
    </div>

  </div>
  </td></tr></table>
</body>
</html>`.trim();
}
