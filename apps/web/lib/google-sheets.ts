import { PhotoOrder } from "@/types/orders";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL!;

async function postToScript(payload: unknown) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json();
  if (!data?.ok) {
    throw new Error(data?.error || "Apps Script request failed");
  }
  return data;
}

export async function appendOrderRow(order: PhotoOrder): Promise<void> {
  await postToScript({
    action: "appendOrder",
    order,
  });
}

export async function updateOrderRowByRef(
  orderRef: string,
  patch: Partial<PhotoOrder>
): Promise<void> {
  await postToScript({
    action: "updateOrderByRef",
    order_ref: orderRef,
    patch,
  });
}

export async function getOrderByRef(orderRef: string): Promise<PhotoOrder | null> {
  const data = await postToScript({
    action: "getOrderByRef",
    order_ref: orderRef,
  });

  return data.order ?? null;
}
