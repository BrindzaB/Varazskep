import { Resend } from "resend";
import { render } from "@react-email/components";
import OrderConfirmation from "@/emails/OrderConfirmation";
import { formatHuf } from "@/lib/utils/format";

const FROM_ADDRESS = "Varázskép <rendeles@varazskep.hu>";

interface SendOrderConfirmationInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  variantColor: string;
  variantSize: string;
  totalAmount: number; // HUF integer
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export async function sendOrderConfirmationEmail(
  input: SendOrderConfirmationInput,
): Promise<void> {
  const html = await render(
    OrderConfirmation({
      customerName: input.customerName,
      orderId: input.orderId,
      productName: input.productName,
      variantColor: input.variantColor,
      variantSize: input.variantSize,
      totalAmount: formatHuf(input.totalAmount),
      shippingAddress: {
        address: input.shippingAddress.address,
        city: input.shippingAddress.city,
        postalCode: input.shippingAddress.postalCode,
      },
    }),
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.customerEmail,
    subject: "Rendelésed megérkezett – Varázskép",
    html,
  });
}
