import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Cancelled | Wildphotography",
  robots: { index: false, follow: false },
};

export default function PaymentCancelledPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <div className="text-6xl mb-4">↩️</div>
        <h1 className="text-3xl font-bold">Payment cancelled</h1>
        <p className="mt-4 text-gray-600">
          No charge was made. You can go back to the photo and try again whenever you&apos;re ready.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Link
          href="/"
          className="rounded-xl bg-blue-600 text-white px-6 py-3 font-medium text-center hover:bg-blue-700 transition-colors"
        >
          Continue browsing
        </Link>
      </div>
    </main>
  );
}
