"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInForm } from "@/components/SignInForm";

const STEPS = [
  { title: "Each fill in one form, separately", body: "Budget, areas you won't consider, must-haves like a lift, and how far you'll travel to work, gym or family." },
  { title: "Add flats you find", body: "Paste in the details and a link to the original listing. Nothing is scraped — you stay in control." },
  { title: "See who gets what", body: "Every flat shows whether it passes everyone's deal-breakers, each person's score, and exactly who is compromising on what." },
  { title: "Decide together", body: "Vote shortlist, discuss or reject. A flat only makes the agreed shortlist when all three say yes." },
];

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (loading || session) return <p className="p-6 text-slate-500">Loading…</p>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <div className="grid items-start gap-8 md:grid-cols-[1fr_22rem]">
        <div>
          <p className="text-sm font-medium text-emerald-700">For 3 roommates flat-hunting in Pune</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
            Find out if a flat works for all three of you — before anyone falls in love with it.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Baner, Kothrud, Hinjewadi, Wakad, Aundh, Viman Nagar… Stop arguing one objection at a time in WhatsApp.
          </p>
        </div>
        <SignInForm />
      </div>
      <ol className="mt-14 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card">
            <span className="text-sm font-semibold text-emerald-700">Step {i + 1}</span>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
