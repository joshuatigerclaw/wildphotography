import { NextRequest, NextResponse } from "next/server";
import { getOrderByRef, updateOrderRowByRef } from "@/lib/google-sheets";
import { sendOrderReturnedEmail } from "@/lib/admin-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderRef = body.order_ref;

    if (!orderRef) {
      return NextResponse.json({ ok: false, error: "Missing order_ref" }, { status: 400 });
    }

    const order = await getOrderByRef(orderRef);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    if (String(order.paypal_returned) !== "true" && order.paypal_returned !== true) {
      await updateOrderRowByRef(orderRef, {
        paypal_returned: true,
        paypal_payment_status: "returned_pending_manual_verification",
      });

      const refreshed = await getOrderByRef(orderRef);
      if (refreshed) {
        await sendOrderReturnedEmail(refreshed);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
