export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getRealtorPhoto } from "@/app/actions/realtor-photo";
import { PhotoForm } from "./PhotoForm";

export default async function RealtorSettingsPage() {
  const photo = await getRealtorPhoto();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Link
          href="/realtors/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-yellow-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Settings
          </p>
          <h1 className="text-3xl font-black sm:text-4xl">Your photo</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Upload a head-shot — the same one you use on your socials works great. It shows up on the gift email your recipient receives and on the gift page they open.
          </p>
        </div>

        <PhotoForm initial={photo} />
      </div>
    </div>
  );
}
