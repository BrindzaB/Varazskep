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

interface OrderFormNotificationProps {
  orderId: string;
  adminUrl: string; // link to the order in the admin panel
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { description: string; quantity: number }[];
  note: string;
  attachmentNames: string[];
}

// Sent to the shop when an order form (megrendelő lap) order arrives.
export default function OrderFormNotification({
  orderId,
  adminUrl,
  customerName,
  customerEmail,
  customerPhone,
  items,
  note,
  attachmentNames,
}: OrderFormNotificationProps) {
  return (
    <Html lang="hu">
      <Head />
      <Preview>Új megrendelés a megrendelő lapon – {customerName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Új megrendelés érkezett</Heading>

          <Text style={text}>
            A megrendelő lapon új megrendelés érkezett. Az ár és az átvétel
            egyeztetése a vevővel még hátravan.
          </Text>

          <Link href={adminUrl} style={button}>
            Megnyitás az adminban
          </Link>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Vevő</Text>
            <Text style={value}>{customerName}</Text>
            <Text style={value}>{customerEmail}</Text>
            <Text style={value}>{customerPhone}</Text>

            <Text style={label}>Termékek</Text>
            {items.length > 0 ? (
              items.map((item, i) => (
                <Text key={i} style={value}>
                  {item.description} × {item.quantity}
                </Text>
              ))
            ) : (
              <Text style={value}>Nincs kiválasztott termék — lásd a szöveget.</Text>
            )}

            <Text style={label}>Megrendelés szövege</Text>
            <Text style={preformatted}>{note}</Text>

            <Text style={label}>Csatolt fájlok</Text>
            <Text style={value}>
              {attachmentNames.length > 0
                ? `${attachmentNames.length} db — letölthető az adminban`
                : "Nincs"}
            </Text>

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
