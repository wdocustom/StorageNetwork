import { useCallback, useEffect, useState } from "react";

interface UseBookingFormParams {
  installerId: string;
}

export function useBookingForm({ installerId }: UseBookingFormParams) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");

  const [hasDifferentDelivery, setHasDifferentDelivery] = useState(false);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showScanWizard, setShowScanWizard] = useState(false);

  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [blackoutDates, setBlackoutDates] = useState<{ start_date: string; end_date: string }[]>([]);

  // Fetch blackout dates when installer is known
  useEffect(() => {
    if (!installerId) return;
    (async () => {
      const { getBlackoutDates } = await import("@/app/actions/blackout-dates");
      const result = await getBlackoutDates(installerId);
      if (result.success) {
        setBlackoutDates(result.dates.map((d: { start_date: string; end_date: string }) => ({ start_date: d.start_date, end_date: d.end_date })));
      }
    })();
  }, [installerId]);

  const setCustomerInfo = useCallback((info: {
    firstName?: string; lastName?: string; email?: string; phone?: string;
    address?: string; city?: string; state?: string; zip?: string;
  }) => {
    if (info.firstName) setFirstName(info.firstName);
    if (info.lastName) setLastName(info.lastName);
    if (info.email) setEmail(info.email);
    if (info.phone) setPhone(info.phone);
    if (info.address) setStreetAddress(info.address);
    if (info.city) setCity(info.city);
    if (info.state) setAddrState(info.state);
    if (info.zip) setAddrZip(info.zip);
  }, []);

  return {
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    phone, setPhone,
    streetAddress, setStreetAddress,
    city, setCity,
    addrState, setAddrState,
    addrZip, setAddrZip,
    hasDifferentDelivery, setHasDifferentDelivery,
    deliveryStreet, setDeliveryStreet,
    deliveryCity, setDeliveryCity,
    deliveryState, setDeliveryState,
    deliveryZip, setDeliveryZip,
    submitting, setSubmitting,
    submitted, setSubmitted,
    submitError, setSubmitError,
    leadId, setLeadId,
    showBookingModal, setShowBookingModal,
    showScanWizard, setShowScanWizard,
    scheduledDate, setScheduledDate,
    blackoutDates,
    setCustomerInfo,
  };
}
