"use client";

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM BUILDER — is this visitor a member?
//
// Works out, once when the builder opens, who is using it:
//   • arriving from checkout (?session_id=…): the subscription is confirmed
//     and recorded, and this device is remembered
//   • arriving from their email link (?token=…), or a token this device
//     kept from last time: checked with the server
//   • otherwise a guest (or a signed-in admin, which the server recognises)
//
// The token is kept on the device (localStorage) so a subscriber is known
// on their next visit, and the one-time parameters are taken out of the
// address bar. The server decides everything; this only remembers the token
// and what the server last said.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { activateBuilderSubscription, getBuilderAccess, type MemberInfo } from "@/app/actions/builder";
import { MEMBER_TOKEN_KEY } from "@/lib/builder/store";

export type Membership =
  | { status: "loading" }
  | { status: "guest"; notice?: string }
  | { status: "member"; member: MemberInfo; token: string | null; welcome?: string }
  /** A real subscriber on a device that hasn't been confirmed yet */
  | { status: "verify"; token: string; emailHint: string }
  /** Their subscription has ended */
  | { status: "inactive"; token: string; notice: string };

function remembered(): string | null {
  try {
    return localStorage.getItem(MEMBER_TOKEN_KEY);
  } catch {
    return null;
  }
}

function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(MEMBER_TOKEN_KEY, token);
    else localStorage.removeItem(MEMBER_TOKEN_KEY);
  } catch {
    /* storage unavailable: they'll use their email link next time */
  }
}

export function useMember(): { membership: Membership; token: string | null; recheck: () => void } {
  const [membership, setMembership] = useState<Membership>({ status: "loading" });
  const started = useRef(false);

  const check = useCallback(async (token: string | null) => {
    const res = await getBuilderAccess(token).catch(() => null);
    if (!res) return setMembership({ status: "guest", notice: "We couldn't reach the server to check your subscription. You can keep designing." });
    if (res.ok) {
      const kept = res.member.token ?? null;
      if (kept) remember(kept);
      return setMembership({ status: "member", member: res.member, token: kept });
    }
    if (res.reason === "verify" && res.verify) return setMembership({ status: "verify", token: res.verify.token, emailHint: res.verify.emailHint });
    if (res.reason === "inactive" && token) return setMembership({ status: "inactive", token, notice: res.error });
    // A token the server doesn't know is no use to keep
    if (token && res.reason === "none") remember(null);
    setMembership({ status: "guest" });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const linkToken = params.get("token");
    if (sessionId || linkToken) {
      params.delete("session_id");
      params.delete("token");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    }

    if (sessionId) {
      activateBuilderSubscription(sessionId)
        .catch(() => null)
        .then((res) => {
          if (res?.ok) {
            const kept = res.member.token ?? null;
            if (kept) remember(kept);
            setMembership({
              status: "member",
              member: res.member,
              token: kept,
              welcome: res.emailSentTo ? `You're subscribed. We emailed your permanent link to ${res.emailSentTo}.` : undefined,
            });
          } else if (res && res.reason === "verify" && res.verify) {
            setMembership({ status: "verify", token: res.verify.token, emailHint: res.verify.emailHint });
          } else {
            setMembership({ status: "guest", notice: res?.error ?? "We couldn't confirm your subscription. Refresh the page to try again." });
          }
        });
      return;
    }
    check(linkToken ?? remembered());
  }, [check]);

  const token =
    membership.status === "member" ? membership.token : membership.status === "verify" || membership.status === "inactive" ? membership.token : null;

  const recheck = useCallback(() => {
    setMembership({ status: "loading" });
    check(token ?? remembered());
  }, [check, token]);

  return { membership, token, recheck };
}
