"use client";

import { motion } from "framer-motion";
import {
  MapPin,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Grid3X3,
  Mail,
  X,
  Send,
} from "lucide-react";
import type { ConfiguratorSidebarProps } from "../configurator-types";
import { FocusFrame } from "../configurator-primitives";
import BestsellerDropdown from "../BestsellerDropdown";
import ShelvingDropdown from "../ShelvingDropdown";
import OverheadStorageDropdown from "../OverheadStorageDropdown";
import RaisedBedDropdown from "../RaisedBedDropdown";
import ChairDropdown from "../ChairDropdown";

export default function StepSize({
  props,
  dimensionPulsing,
  wallW,
  wallH,
  hasWallDimensions,
  setActiveStep,
}: {
  props: ConfiguratorSidebarProps;
  dimensionPulsing: boolean;
  wallW: number;
  wallH: number;
  hasWallDimensions: boolean;
  setActiveStep: (step: number) => void;
}) {
  return (
    <>
      {/* ZIP Check (hidden when installer locked) */}
      {!props.installerLocked && (
        <section className="rounded-xl border border-dashed border-yellow-400/40 bg-yellow-400/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-yellow-400/80">
            <MapPin className="h-3.5 w-3.5" />
            Find My Local Pro
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={props.zip}
              onChange={(e) => {
                props.onZipChange(e.target.value.replace(/\D/g, "").slice(0, 5));
                props.onZipResultClear();
              }}
              placeholder="ZIP Code"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
            />
            <button
              onClick={props.onZipCheck}
              disabled={props.zip.length < 5 || props.zipChecking}
              className="shrink-0 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-900 transition-colors hover:bg-yellow-300 disabled:opacity-40"
            >
              {props.zipChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
            </button>
          </div>
          {props.zipResult?.available && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 space-y-1.5"
            >
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {props.zipResult.message}
              </div>
              <p className="text-xs text-zinc-400">
                Your free 3D design is ready — let&apos;s build it!
              </p>
            </motion.div>
          )}
          {props.zipResult && !props.zipResult.available && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-xs font-semibold text-amber-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {props.zipResult.message}
            </motion.div>
          )}
        </section>
      )}

      {/* Auto-Fit Wall Calculator */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Maximize2 className="h-3.5 w-3.5 text-yellow-400" />
          Auto-Fit Wall Calculator
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FocusFrame label="Wall Width (inches)" pulsing={dimensionPulsing}>
            <input
              type="number"
              inputMode="decimal"
              value={props.wallWidth}
              onChange={(e) => props.onWallWidthChange(e.target.value)}
              placeholder="e.g. 100"
              className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
            />
          </FocusFrame>
          <FocusFrame label="Wall Height (inches)" pulsing={dimensionPulsing}>
            <input
              type="number"
              inputMode="decimal"
              value={props.wallHeight}
              onChange={(e) => props.onWallHeightChange(e.target.value)}
              placeholder="e.g. 96"
              className="w-full bg-transparent text-sm font-medium text-white placeholder-zinc-600 focus:outline-none"
            />
          </FocusFrame>
        </div>
        <motion.button
          onClick={() => {
            props.onWallFit();
          }}
          disabled={!props.wallWidth || !props.wallHeight || props.buildLoading}
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-40"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {props.buildLoading ? "Calculating..." : "Find Max Size"}
        </motion.button>
        {props.wallFitMsg && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center text-xs font-semibold text-emerald-400"
          >
            {props.wallFitMsg}
          </motion.p>
        )}
      </section>

      {/* Grid Size — moved up for structured placement */}
      {!props.activePreset && (
        <section className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 backdrop-blur-sm">
          <Grid3X3 className="h-4 w-4 shrink-0 text-yellow-400" />
          <span className="shrink-0 text-sm font-medium text-zinc-300">
            Grid Size
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Col</label>
              <input
                type="number"
                min={1}
                max={12}
                value={props.cols}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  props.onColsChange(v === "" ? "" : parseInt(v) || "");
                }}
                onBlur={() => {
                  const n = typeof props.cols === "number" ? props.cols : parseInt(props.cols as string);
                  props.onColsChange(Math.min(12, Math.max(1, n || 1)));
                }}
                className="w-12 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-center text-sm font-bold text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
              />
            </div>
            <span className="text-zinc-600">&times;</span>
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Tier</label>
              <input
                type="number"
                min={1}
                max={props.unitType === "mini" ? 4 : props.use2x4Rails ? 6 : 10}
                value={props.rows}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  props.onRowsChange(v === "" ? "" : parseInt(v) || "");
                }}
                onBlur={() => {
                  const n = typeof props.rows === "number" ? props.rows : parseInt(props.rows as string);
                  const maxT = props.unitType === "mini" ? 4 : props.use2x4Rails ? 6 : 10;
                  props.onRowsChange(Math.min(maxT, Math.max(1, n || 1)));
                }}
                className="w-12 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-center text-sm font-bold text-white focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400/30"
              />
            </div>
          </div>
        </section>
      )}

      {/* Bestsellers Dropdown */}
      {props.presetOptions.length > 0 && (
        <BestsellerDropdown
          presetOptions={props.presetOptions}
          activePreset={props.activePreset}
          onPresetChange={props.onPresetChange}
          compoundBuild={props.compoundBuild}
          presetLoading={props.presetLoading}
          presetTotes={props.presetTotes}
          onPresetTotesChange={props.onPresetTotesChange}
          onAddPresetUnit={() => { if (props.onAddPresetUnit()) setActiveStep(4); }}
          wallW={wallW}
          wallH={wallH}
          hasWallDimensions={hasWallDimensions}
          totesDisabled={props.totesDisabled}
        />
      )}

      {/* Open Shelving Dropdown */}
      {!props.shelvingHidden && (
        <ShelvingDropdown
          shelvingConfigId={props.shelvingConfigId}
          onShelvingConfigChange={props.onShelvingConfigChange}
          shelvingPrice={props.shelvingPrice}
          shelvingLoading={props.shelvingLoading}
          onAddShelvingUnit={() => { props.onAddShelvingUnit(); setActiveStep(4); }}
        />
      )}

      {/* Overhead Ceiling Storage Dropdown */}
      {!props.overheadStorageHidden && (
        <OverheadStorageDropdown
          onAddOverheadUnit={(result, config) => {
            props.onAddOverheadUnit(result, config);
            setActiveStep(4);
          }}
          onConfigPreview={props.onOverheadConfigPreview}
          installerPricing={props.pricing as import("@/types/viewModels").InstallerPricing | undefined}
        />
      )}

      {/* Raised Bed Planters Dropdown */}
      {!props.raisedBedHidden && (
        <RaisedBedDropdown
          onAddRaisedBed={(config, price, desc) => {
            props.onAddRaisedBed(config, price, desc);
            setActiveStep(4);
          }}
          onConfigPreview={props.onRaisedBedPreview}
          onPriceChange={props.onRaisedBedPriceChange}
          installerPricing={props.pricing as import("@/types/viewModels").InstallerPricing | undefined}
        />
      )}

      {/* Low Boy Adirondack Chair Dropdown */}
      {!props.chairHidden && (
        <ChairDropdown
          onAddChair={(config, price, desc) => {
            props.onAddChair(config, price, desc);
            setActiveStep(4);
          }}
          onConfigPreview={props.onChairPreview}
          onPriceChange={props.onChairPriceChange}
          installerPricing={props.pricing as Record<string, unknown> | undefined}
        />
      )}

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
