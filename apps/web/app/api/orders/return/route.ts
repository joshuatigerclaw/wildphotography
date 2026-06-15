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

    const alreadyReturned = String(order.paypal_returned) === "true" || order.paypal_returned === true;

    if (!alreadyReturned) {
      await updateOrderRowByRef(orderRef, {
        paypal_returned: true,
        paypal_payment_status: "returned_pending_manual_verification",
      });

      const refreshed = await getOrderByRef(orderRef);
      if (refreshed) {
        try {
          await sendOrderReturnedEmail(refreshed);
        } catch (emailError) {
          console.error("Return email failed:", String(emailError));
        }
      }
    }

    return NextResponse.json({
      ok: true,
      orderRef,
      alreadyReturned,
      photoTitle: order.photo_title,
      buyerEmail: order.buyer_email,
    });
  } catch (error) {
    console.error("Order return error:", String(error));
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
