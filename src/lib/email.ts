// Barrel re-export — all email functionality lives in src/lib/emails/*.ts
// This file preserves backward compatibility so existing imports don't break.

export {
  sendTransactionalEmail,
  emailShell,
  type SendEmailParams,
  type SendEmailResult,
} from "./emails/core";

export {
  sendBookingConfirmation,
  sendInstallScheduledNotice,
  sendJobReceipt,
  sendWaitlistCustomerConfirmation,
  buildQuoteEmailTemplate,
  sendAbandonedCartEmail,
  sendDemoConfirmationEmail,
  sendCleanoutUpsellEmail,
  sendCleanoutUpsellConfirmation,
  sendTrialCapCustomerConfirmation,
  sendWaitlistedLeadPaymentReady,
  sendWaitlistJoinedNotice,
  quoteDataToBookingUnits,
  type BookingConfirmationData,
  type BookingConfirmationUnit,
  type QuoteEmailData,
  type CleanoutUpsellEmailData,
  type CleanoutUpsellConfirmationData,
} from "./emails/customerTemplates";

export {
  sendNewBookingAlert,
  sendPaymentReceivedAlert,
  sendInstallerOnboardingEmail,
  sendOnboardingEmail2_QRCode,
  sendOnboardingEmail3_FirstSale,
  sendOnboardingEmail4_Scarcity,
  sendInstallerWelcome,
  sendProWelcomeEmail,
  sendProRenewalReceipt,
  sendWaitlistAlert,
  buildCustomerInquiryTemplate,
  sendReferralHandoffEmail,
  sendBountyPaidEmail,
  sendDemoOwnerNotification,
  sendCleanoutUpsellInstallerAlert,
  sendTrialCapHotLead,
  sendWaitlistedLeadsUnlocked,
  maskEmail,
  maskPhone,
  maskName,
  type CustomerInquiryData,
} from "./emails/installerTemplates";

export {
  sendAffiliateApplicationReceivedEmail,
  sendAffiliateApplicationAdminAlert,
  sendAffiliateAgreementProposedEmail,
  sendAffiliateApplicationRejectedEmail,
  sendAffiliateAgreementAcceptedAdminAlert,
  sendAffiliateColdInviteEmail,
} from "./emails/affiliateTemplates";

export {
  sendRealtorWelcomeEmail,
  sendGiftRecipientInvite,
  sendGiftMagicCodeEmail,
  sendRealtorGiftReceipt,
  sendGiftInstallerAssignedAlert,
  sendGiftRecipientAssignedUpdate,
  sendGiftRealtorAssignedUpdate,
  sendGiftDeliveredRecipient,
  sendGiftReturnedRecipient,
  sendGiftCancelledRecipient,
  sendGiftEarlyPickupRequestAlert,
} from "./emails/realtorTemplates";

export {
  sendFeatureAnnouncement,
  sendBountyAnnouncementEmail,
  sendOverheadAnnouncementEmail,
  sendJigAnnouncementEmail,
  sendFeedbackCallInvite,
  sendInventoryAnnouncementEmail,
  sendWeeklyDigestEmail,
  sendAssetForgeAnnouncementEmail,
  sendToteRentalAnnouncementEmail,
  type FeatureAnnouncementData,
  type BountyAnnouncementData,
  type OverheadAnnouncementData,
  type JigAnnouncementData,
  type WeeklyDigestData,
  type AssetForgeAnnouncementData,
} from "./emails/announcementTemplates";
