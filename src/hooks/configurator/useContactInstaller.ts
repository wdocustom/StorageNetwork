import { useCallback, useEffect, useState } from "react";
import { contactInstaller } from "@/app/actions/contact-installer";
import type { UnitConfig } from "./types";

interface UseContactInstallerParams {
  installerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  grandTotal: number;
  orderItems: UnitConfig[];
  zip: string;
}

export function useContactInstaller({
  installerId,
  firstName,
  lastName,
  email,
  phone,
  grandTotal,
  orderItems,
  zip,
}: UseContactInstallerParams) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  // Auto-dismiss "Message Sent" after 5 seconds
  useEffect(() => {
    if (!contactSent) return;
    const timer = setTimeout(() => {
      setContactSent(false);
      setShowContactForm(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [contactSent]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleContactInstaller = useCallback(async () => {
    if (!contactMessage.trim()) {
      setContactError("Please enter a message.");
      return;
    }
    if (!email.trim()) {
      setContactError("Please enter your email so the installer can reply.");
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setContactError("Please enter a valid email address.");
      return;
    }
    if (!installerId) {
      setContactError("No installer assigned yet.");
      return;
    }

    setContactSending(true);
    setContactError("");
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "Customer";
      const result = await contactInstaller({
        installerId,
        customerName: fullName,
        customerEmail: email.trim(),
        customerPhone: phone.trim() || undefined,
        message: contactMessage.trim(),
        quoteTotal: grandTotal > 0 ? grandTotal : undefined,
        quoteData: orderItems.length > 0 ? orderItems : undefined,
        zip: zip || undefined,
      });

      if (!result.success) {
        setContactError(result.error || "Failed to send message.");
        return;
      }

      setContactSent(true);
      setContactMessage("");
    } catch {
      setContactError("Failed to send message. Please try again.");
    } finally {
      setContactSending(false);
    }
  }, [contactMessage, email, installerId, firstName, lastName, phone, grandTotal, orderItems, zip]);

  return {
    showContactForm, setShowContactForm,
    contactMessage, setContactMessage,
    contactSending,
    contactSent,
    contactError,
    handleContactInstaller,
  };
}
