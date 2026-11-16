"use client";

import { useEffect } from "react";
import { recordGiftOpened } from "@/app/actions/plan-gifts";

/**
 * Marks a gift "Opened" for the gifter. Runs in the browser only, so mail
 * providers' link scanners (which fetch the page but don't run it) don't
 * count as the recipient opening their gift.
 */
export default function GiftOpenedBeacon({ token }: { token: string }) {
  useEffect(() => {
    recordGiftOpened(token).catch(() => {});
  }, [token]);
  return null;
}
