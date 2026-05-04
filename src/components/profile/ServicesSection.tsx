"use client";

import { useCallback, useState } from "react";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Wrench,
  DollarSign,
} from "lucide-react";
import {
  updateServicesConfig,
} from "@/app/actions/profile";
import { DEFAULT_SERVICES, type ServiceOffering } from "@/config/services";
import { roundMoney } from "@/utils/mathHelpers";

// ═══════════════════════════════════════════════════════════════════════════
// Services Section — Manage service offerings shown on portfolio page
// Renders inside the dashboard profile page
// ═══════════════════════════════════════════════════════════════════════════

interface ServicesSectionProps {
  userId: string;
  initialServices: ServiceOffering[] | null;
}

export default function ServicesSection({ userId, initialServices }: ServicesSectionProps) {
  const [services, setServices] = useState<ServiceOffering[]>(
    initialServices ?? DEFAULT_SERVICES
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ── Handlers ────────────────────────────────────────────────────────────

  function toggleService(id: string) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function updateServiceField(id: string, field: "name" | "description" | "price", value: string) {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (field === "price") {
          const num = parseFloat(value);
          return { ...s, price: isNaN(num) ? null : roundMoney(num) };
        }
        return { ...s, [field]: value };
      })
    );
  }

  function addCustomService() {
    const newService: ServiceOffering = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      price: 0,
      enabled: true,
      built_in: false,
    };
    setServices((prev) => [...prev, newService]);
  }

  function removeCustomService(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSave() {
    // Validate custom services have names
    const invalid = services.find((s) => !s.built_in && s.enabled && !s.name.trim());
    if (invalid) {
      setMessage("Please give each enabled custom service a name.");
      return;
    }

    setSaving(true);
    setMessage("");

    const result = await updateServicesConfig(userId, services);

    setSaving(false);
    if (result.success) {
      setMessage("Services saved!");
    } else {
      setMessage(result.error || "Failed to save.");
    }
    setTimeout(() => setMessage(""), 4000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Human-friendly label for built-in service IDs */
  function builtInLabel(id: string): string {
    switch (id) {
      case "tote_storage":
        return "Custom Tote Storage";
      case "cleanout_1car":
        return "1-Car Garage Clean Out";
      case "cleanout_2car":
        return "2-Car Garage Clean Out";
      case "cleanout_3car":
        return "3+ Car Garage Clean Out";
      default:
        return id;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const builtInServices = services.filter((s) => s.built_in);
  const customServices = services.filter((s) => !s.built_in);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-yellow-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Services Offered
        </h2>
      </div>

      <p className="mb-5 text-xs text-stone-500">
        Toggle services on or off. Enabled services appear on your public portfolio page.
        Customize pricing for built-in services or add your own.
      </p>

      {/* ── Built-in Services ──────────────────────────────────────────── */}
      <div className="mb-5 space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-600">
          Built-in Services
        </h3>

        {builtInServices.map((service) => (
          <div
            key={service.id}
            className={`rounded-xl border p-4 transition-all ${
              service.enabled
                ? "border-slate-700 bg-slate-800/60"
                : "border-slate-800 bg-slate-800/20 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleService(service.id)}
                className="shrink-0"
                title={service.enabled ? "Disable" : "Enable"}
              >
                {service.enabled ? (
                  <ToggleRight className="h-6 w-6 text-yellow-400" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-stone-600" />
                )}
              </button>

              {/* Info */}
              <div className="flex-1">
                <p className="text-sm font-bold text-white">
                  {builtInLabel(service.id)}
                </p>
                <p className="text-[11px] text-stone-400">{service.description}</p>
              </div>

              {/* Price (editable for cleanout, not for tote_storage) */}
              {service.id !== "tote_storage" ? (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-stone-500" />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={service.price ?? ""}
                    onChange={(e) => updateServiceField(service.id, "price", e.target.value)}
                    className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-right text-sm font-bold text-yellow-400 focus:border-yellow-400 focus:outline-none"
                    disabled={!service.enabled}
                  />
                </div>
              ) : (
                <span className="text-[11px] font-semibold text-stone-500">
                  Via Configurator
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Custom Services ────────────────────────────────────────────── */}
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-600">
            Custom Services
          </h3>
          <button
            type="button"
            onClick={addCustomService}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-800/40 px-2.5 py-1 text-[11px] font-semibold text-stone-400 transition-colors hover:border-yellow-400/40 hover:text-yellow-400"
          >
            <Plus className="h-3 w-3" />
            Add Service
          </button>
        </div>

        {customServices.length === 0 && (
          <p className="py-4 text-center text-xs text-stone-600">
            No custom services yet. Add one above to offer additional services on your portfolio.
          </p>
        )}

        {customServices.map((service) => (
          <div
            key={service.id}
            className={`rounded-xl border p-4 transition-all ${
              service.enabled
                ? "border-slate-700 bg-slate-800/60"
                : "border-slate-800 bg-slate-800/20 opacity-60"
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleService(service.id)}
                className="shrink-0"
                title={service.enabled ? "Disable" : "Enable"}
              >
                {service.enabled ? (
                  <ToggleRight className="h-6 w-6 text-yellow-400" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-stone-600" />
                )}
              </button>

              {/* Name */}
              <input
                type="text"
                value={service.name}
                onChange={(e) => updateServiceField(service.id, "name", e.target.value)}
                placeholder="Service name"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />

              {/* Price + Delete */}
              <div className="flex shrink-0 items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-stone-500" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={service.price ?? ""}
                  onChange={(e) => updateServiceField(service.id, "price", e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-right text-sm font-bold text-yellow-400 placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeCustomService(service.id)}
                  className="shrink-0 rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Remove service"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="pl-9">
              <input
                type="text"
                value={service.description}
                onChange={(e) => updateServiceField(service.id, "description", e.target.value)}
                placeholder="Brief description (optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Save ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-gray-950 transition-all hover:bg-yellow-300 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Services
        </button>

        {message && (
          <span
            className={`text-xs font-medium ${
              message.includes("saved") ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </section>
  );
}
