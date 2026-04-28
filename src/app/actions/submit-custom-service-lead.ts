"use server";

import { getDepositAmount } from "@/app/actions/fee-engine";
import { getServiceClient } from "@/lib/supabase-server";
import { calculateBalanceDue } from "@/utils/mathHelpers";

const supabase = getServiceClient();

export interface CustomServiceLeadInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  installer_id: string;
  service_name: string;
  service_price: number;
  source?: "platform" | "partner_link";
}

export async function submitCustomServiceLead(input: CustomServiceLeadInput): Promise<{
  success: boolean;
  id?: string;
  totalPrice?: number;
  depositAmount?: number;
  error?: string;
}> {
  if (!input.customer_name?.trim()) {
    return { success: false, error: "Name is required." };
  }
  if (!input.customer_email?.trim()) {
    return { success: false, error: "Email is required." };
  }
  if (!input.customer_phone?.trim()) {
    return { success: false, error: "Phone is required." };
  }
  if (!input.service_name?.trim()) {
    return { success: false, error: "Service name is missing." };
  }
  if (input.service_price <= 0) {
    return { success: false, error: "Invalid service price." };
  }

  const totalPrice = input.service_price;

  try {
    const depositAmount = await getDepositAmount(totalPrice, input.installer_id);
    const balanceDue = calculateBalanceDue(totalPrice, depositAmount);

    const notes = `Custom Service: ${input.service_name} — $${totalPrice}`;

    const quoteData = [
      {
        cols: 0,
        rows: 0,
        toteType: "custom_service",
        hasTotes: false,
        hasWheels: false,
        hasTop: false,
        price: totalPrice,
        totalW: 0,
        totalH: 0,
        desc: input.service_name,
      },
    ];

    const { data, error } = await supabase
      .from("leads")
      .insert({
        installer_id: input.installer_id,
        is_network_lead: true,
        customer_name: input.customer_name.trim(),
        customer_email: input.customer_email.trim(),
        customer_phone: input.customer_phone.trim(),
        quote_data: quoteData,
        estimated_price: totalPrice,
        deposit_amount: depositAmount,
        deposit_paid: false,
        balance_due: balanceDue,
        source: input.source || "partner_link",
        status: "pending_payment",
        notes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Custom service lead insert failed:", error);
      return { success: false, error: "Failed to create booking. Please try again." };
    }

    return {
      success: true,
      id: data.id,
      totalPrice,
      depositAmount,
    };
  } catch (err: any) {
    console.error("Custom service lead submission failed:", err);
    return { success: false, error: err.message || "Failed to submit." };
  }
}
