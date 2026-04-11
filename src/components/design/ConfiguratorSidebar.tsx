"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ConfiguratorSidebarProps } from "./configurator-types";
import ConfiguratorStepper from "./ConfiguratorStepper";
import ConfiguratorFooter from "./ConfiguratorFooter";
import AIGuideBar from "./AIGuideBar";
import StepSize from "./steps/StepSize";
import StepConfiguration from "./steps/StepConfiguration";
import StepAddons from "./steps/StepAddons";
import StepSummary from "./steps/StepSummary";

export type { ConfiguratorSidebarProps };
export type { ToteType, ToteColor, UnitType, Orientation, UnitConfig, ServerBuild } from "./configurator-types";

export default function ConfiguratorSidebar(props: ConfiguratorSidebarProps) {
  const [activeStep, setActiveStep] = useState(props.initialStep ?? 1);
  const [dimensionPulsing, setDimensionPulsing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // After "Find Max" is clicked and succeeds, pulse the dimension inputs
  const prevWallFitMsg = useRef(props.wallFitMsg);
  useEffect(() => {
    if (props.wallFitMsg && props.wallFitMsg !== prevWallFitMsg.current) {
      setDimensionPulsing(true);
      props.onPulseVisualizerTrigger?.();
      const t = setTimeout(() => setDimensionPulsing(false), 3600);
      prevWallFitMsg.current = props.wallFitMsg;
      return () => clearTimeout(t);
    }
    prevWallFitMsg.current = props.wallFitMsg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.wallFitMsg]);

  // Scroll to top when step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  const numCols = typeof props.cols === "number" ? props.cols : parseInt(props.cols as string) || 0;
  const numRows = typeof props.rows === "number" ? props.rows : parseInt(props.rows as string) || 0;

  // "Your Details" collapse state
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const detailsFilled = !!(props.firstName.trim() && props.lastName.trim() && props.email.trim() && props.phone.trim() && props.streetAddress.trim() && props.city.trim() && props.addrState.trim() && props.addrZip.trim());

  const goNext = () => setActiveStep((s) => Math.min(4, s + 1));
  const goPrev = () => setActiveStep((s) => Math.max(1, s - 1));
  const hasQuoteItems = props.orderItems.length > 0;

  // Wall dimensions for bestseller fit check
  const wallW = parseFloat(props.wallWidth) || 0;
  const wallH = parseFloat(props.wallHeight) || 0;
  const hasWallDimensions = wallW > 0 && wallH > 0;

  return (
    <aside className="order-2 flex w-full shrink-0 flex-col bg-zinc-950 lg:order-1 lg:h-full lg:w-[40%] xl:w-[38%]">
      <ConfiguratorStepper
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        hasQuoteItems={hasQuoteItems}
      />

      <AIGuideBar activeStep={activeStep} />

      <div ref={scrollRef} className="flex-1 lg:overflow-y-auto lg:scrollbar-dark">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-4 p-4"
          >
            {activeStep === 1 && (
              <StepSize
                props={props}
                dimensionPulsing={dimensionPulsing}
                wallW={wallW}
                wallH={wallH}
                hasWallDimensions={hasWallDimensions}
                goNext={goNext}
                setActiveStep={setActiveStep}
              />
            )}

            {activeStep === 2 && (
              <StepConfiguration
                props={props}
                goNext={goNext}
                goPrev={goPrev}
              />
            )}

            {activeStep === 3 && (
              <StepAddons
                props={props}
                numCols={numCols}
                numRows={numRows}
                goPrev={goPrev}
                setActiveStep={setActiveStep}
              />
            )}

            {activeStep === 4 && (
              <StepSummary
                props={props}
                hasQuoteItems={hasQuoteItems}
                detailsCollapsed={detailsCollapsed}
                setDetailsCollapsed={setDetailsCollapsed}
                detailsFilled={detailsFilled}
                setActiveStep={setActiveStep}
                goPrev={goPrev}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ConfiguratorFooter
        props={props}
        activeStep={activeStep}
        detailsFilled={detailsFilled}
      />
    </aside>
  );
}
