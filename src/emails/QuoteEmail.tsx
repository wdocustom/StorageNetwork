import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import * as React from "react";

// ═══════════════════════════════════════════════════════════════════════════
// QuoteEmail — Transactional quote email sent from installer to homeowner.
// Rendered server-side via @react-email/render and sent through Resend.
// ═══════════════════════════════════════════════════════════════════════════

export interface QuoteEmailProps {
  customerFirstName: string;
  installerFirstName: string;
  installerBusinessName: string;
  installerPhone?: string;
  unitSummaryText: string;
  grandTotal: number;
  depositAmount: number;
  checkoutUrl: string;
}

export default function QuoteEmail({
  customerFirstName = "there",
  installerFirstName = "Your Installer",
  installerBusinessName = "Storage Network",
  installerPhone,
  unitSummaryText = "Custom Storage Unit",
  grandTotal = 0,
  depositAmount = 0,
  checkoutUrl = "#",
}: QuoteEmailProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>
        Click to view your interactive 3D design and secure your installation
        date.
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ── Greeting ─────────────────────────────────────────────── */}
          <Text style={paragraph}>Hi {customerFirstName},</Text>

          <Text style={paragraph}>
            I&apos;ve finished drafting the design for your custom storage
            system.
          </Text>

          <Text style={paragraph}>
            You can click the secure link below to view the interactive 3D model
            of your exact build, review the dimensions, and make sure everything
            looks perfect for your space.
          </Text>

          {/* ── Build Summary ────────────────────────────────────────── */}
          <Section style={summaryCard}>
            <Text style={summaryHeading}>Your Build Summary</Text>

            <table style={summaryTable} cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={labelCell}>System Design</td>
                  <td style={valueCell}>{unitSummaryText}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Total Investment</td>
                  <td style={valueCell}>
                    ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span style={finePrint}>
                      {" "}
                      (Includes custom build, materials, and installation)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={labelCell}>Deposit to Book</td>
                  <td style={depositValue}>
                    ${depositAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Body Copy ────────────────────────────────────────────── */}
          <Text style={paragraph}>
            To officially get your project on my schedule, simply review the
            design via the link below and place the initial deposit. Once that is
            locked in, I will reserve your spot on the calendar, prep your
            materials, and we will be ready for installation day!
          </Text>

          {/* ── CTA Button ───────────────────────────────────────────── */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={checkoutUrl}>
              View 3D Design &amp; Secure Installation
            </Button>
          </Section>

          <Text style={mutedParagraph}>
            If you want to make any tweaks to the size or layout, you can adjust
            it right there in the 3D viewer before booking.
          </Text>

          <Text style={paragraph}>
            Looking forward to getting your space organized!
          </Text>

          {/* ── Sign-off ─────────────────────────────────────────────── */}
          <Text style={paragraph}>
            Best,
            <br />
            {installerFirstName}
            <br />
            {installerBusinessName}
            {installerPhone && (
              <>
                <br />
                {installerPhone}
              </>
            )}
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            *Sales tax (if applicable) will be collected by your installer at the
            time of installation. Questions? Simply reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  margin: "40px auto",
  maxWidth: "560px",
  padding: "40px 32px",
};

const paragraph: React.CSSProperties = {
  color: "#333333",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 18px",
};

const mutedParagraph: React.CSSProperties = {
  ...paragraph,
  color: "#64748b",
  fontSize: "14px",
};

// ── Summary Card ──────────────────────────────────────────────────────────

const summaryCard: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "24px 0",
};

const summaryHeading: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  margin: "0 0 16px",
  textTransform: "uppercase",
};

const summaryTable: React.CSSProperties = {
  width: "100%",
};

const labelCell: React.CSSProperties = {
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 600,
  padding: "6px 0",
  verticalAlign: "top",
  width: "130px",
};

const valueCell: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "14px",
  fontWeight: 600,
  padding: "6px 0",
  verticalAlign: "top",
};

const depositValue: React.CSSProperties = {
  ...valueCell,
  color: "#16a34a",
  fontSize: "16px",
  fontWeight: 800,
};

const finePrint: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 400,
  fontStyle: "italic",
};

// ── CTA ───────────────────────────────────────────────────────────────────

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "28px 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#FACC15",
  borderRadius: "10px",
  color: "#1a1a1a",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 800,
  letterSpacing: "0.3px",
  padding: "16px 36px",
  textDecoration: "none",
  textAlign: "center" as const,
};

// ── Footer ────────────────────────────────────────────────────────────────

const divider: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "28px 0 16px",
};

const footer: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  fontStyle: "italic",
  lineHeight: "1.5",
  margin: 0,
};
