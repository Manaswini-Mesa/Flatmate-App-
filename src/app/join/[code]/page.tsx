"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { errorMessage, supabase } from "@/lib/supabase";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  return <RequireAuth>{() => <Joiner code={code} />}</RequireAuth>;
}

function Joiner({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    supabase.rpc("join_group", { code }).then(({ error }) => {
      if (error) setError(errorMessage(error));
      else router.replace("/dashboard");
    });
  }, [code, router]);

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      {error ? (
        <div className="card">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="btn-secondary mt-4">
            Go to my dashboard
          </Link>
        </div>
      ) : (
        <p className="text-slate-500">Joining the group…</p>
      )}
    </main>
  );
}
