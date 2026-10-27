"use client";

// "Need something custom?" — email the installer from the designer. Shared by
// the step-by-step configurator and the design studio.

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, Send, X } from "lucide-react";
import type { ConfiguratorSidebarProps } from "./configurator-types";

export default function ContactInstallerCard({ props }: { props: ConfiguratorSidebarProps }) {
  return (
    <>
      {/* Contact Installer — Custom / Email */}
      {props.installerId && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          {!props.showContactForm && !props.contactSent ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-yellow-400/80">
                Need something custom?
              </span>
              <button
                onClick={() => props.onShowContactFormChange(true)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                <Mail className="h-3 w-3" />
                Email
              </button>
            </div>
          ) : props.contactSent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center"
            >
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
              <p className="text-xs font-semibold text-zinc-200">Message Sent!</p>
              <p className="text-[11px] text-zinc-500">
                {props.brandingTitle || "The installer"} will get back to you shortly.
              </p>
            </motion.div>
          ) : (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Mail className="h-3.5 w-3.5 text-yellow-400" />
                  Email {props.brandingTitle || "Installer"}
                </span>
                <button
                  onClick={() => props.onShowContactFormChange(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={props.firstName}
                    onChange={(e) => props.onFirstNameChange(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={props.lastName}
                    onChange={(e) => props.onLastNameChange(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    placeholder="Your Email"
                    value={props.email}
                    onChange={(e) => props.onEmailChange(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={props.phone}
                    onChange={(e) => props.onPhoneChange(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <textarea
                  value={props.contactMessage}
                  onChange={(e) => props.onContactMessageChange(e.target.value)}
                  placeholder="Describe your custom project..."
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
                />
              </div>
              {props.contactError && (
                <p className="mt-1 text-xs font-medium text-red-400">{props.contactError}</p>
              )}
              <button
                onClick={props.onContactInstaller}
                disabled={props.contactSending || !props.contactMessage.trim()}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {props.contactSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {props.contactSending ? "Sending..." : "Send Message"}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
