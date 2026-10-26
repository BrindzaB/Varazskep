import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface OrderNotificationProps {
  orderId: string;
  adminUrl: string; // link to the order in the admin panel
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: {
    description: string; // e.g. "Póló – Fekete, M"
    quantity: number;
    withPrint: boolean;
    lineTotal: string; // pre-formatted, product + print fee × quantity
  }[];
  totalAmount: string; // pre-formatted, e.g. "4 990 Ft"
  methodLabel: string; // e.g. "GLS átvételi pont"
  shippingCost: string; // pre-formatted
  // Delivery point name + address, or the home delivery address — already formatted.
  destination: string;
}

// Sent to the shop when a paid webshop order arrives (Stripe webhook).
export default function OrderNotification({
  orderId,
  adminUrl,
  customerName,
  customerEmail,
  customerPhone,
  items,
  totalAmount,
  methodLabel,
  shippingCost,
  destination,
}: OrderNotificationProps) {
  return (
    <Html lang="hu">
      <Head />
      <Preview>
        Új webshopos rendelés – {customerName}, {totalAmount}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Új rendelés érkezett</Heading>

          <Text style={text}>
            A webshopban új, kifizetett rendelés érkezett.
          </Text>

          <Link href={adminUrl} style={button}>
            Megnyitás az adminban
          </Link>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Vevő</Text>
            <Text style={value}>{customerName}</Text>
            <Text style={value}>{customerEmail}</Text>
            {customerPhone ? <Text style={value}>{customerPhone}</Text> : null}

            <Text style={label}>Termékek</Text>
            {items.map((item, i) => (
              <Text key={i} style={value}>
                {item.description}
                {item.withPrint ? " (egyedi nyomtatással)" : ""} ×{" "}
                {item.quantity} – {item.lineTotal}
              </Text>
            ))}

            <Text style={label}>Végösszeg</Text>
            <Text style={value}>{totalAmount}</Text>

            <Text style={label}>Szállítás</Text>
            <Text style={value}>
              {methodLabel} – {shippingCost}
            </Text>
            <Text style={preformatted}>{destination}</Text>

            <Text style={label}>Azonosító</Text>
            <Text style={value}>{orderId}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e9ecef",
  borderRadius: "4px",
  margin: "40px auto",
  maxWidth: "560px",
  padding: "40px",
};

const heading: React.CSSProperties = {
  color: "#32373c",
  fontSize: "24px",
  fontWeight: "700",
  marginBottom: "16px",
};

const text: React.CSSProperties = {
  color: "#32373c",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const button: React.CSSProperties = {
  backgroundColor: "#32373c",
  borderRadius: "4px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  padding: "10px 18px",
  textDecoration: "none",
};

const label: React.CSSProperties = {
  color: "#6c757d",
  fontSize: "13px",
  fontWeight: "500",
  margin: "12px 0 2px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const value: React.CSSProperties = {
  color: "#32373c",
  fontSize: "15px",
  margin: "0 0 4px",
};

const preformatted: React.CSSProperties = {
  ...value,
  whiteSpace: "pre-wrap",
};

const hr: React.CSSProperties = {
  borderColor: "#e9ecef",
  margin: "24px 0",
};
