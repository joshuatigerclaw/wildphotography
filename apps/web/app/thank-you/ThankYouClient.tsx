"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ThankYouClient() {
  const searchParams = useSearchParams();
  const orderRef = searchParams.get("order_ref") || "";
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(!!orderRef);

  useEffect(() => {
    if (!orderRef) return;

    setLoading(true);
    fetch("/api/orders/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_ref: orderRef }),
    })
      .finally(() => {
        setLoading(false);
        setDone(true);
      });
  }, [orderRef]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold">Thank you for your order</h1>
        <p className="mt-4 text-gray-600">
          Your payment is being verified manually. You&apos;ll receive an email with your download link shortly.
        </p>

        {orderRef && (
          <div className="mt-6 inline-block rounded-xl border border-gray-200 bg-gray-50 px-6 py-4">
            <p className="text-sm text-gray-500">Order reference</p>
            <p className="text-xl font-mono font-bold">{orderRef}</p>
          </div>
        )}

        {loading && (
          <p className="mt-4 text-sm text-gray-400">Finalizing your order record...</p>
        )}

        {done && !loading && (
          <p className="mt-4 text-sm text-green-600 font-medium">
            ✓ Order record updated
          </p>
        )}

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-xl bg-blue-600 text-white px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
          >
            Continue browsing
          </Link>
        </div>
      </div>
    </main>
  );
}
