import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface OrderFormReceivedProps {
  customerName: string;
  orderId: string;
  items: { description: string; quantity: number }[];
  note: string;
  attachmentNames: string[];
}

// Sent to the customer after an order form (megrendelő lap) submission. The order has no
// price yet — the shop contacts the customer to settle the details and the cost.
export default function OrderFormReceived({
  customerName,
  orderId,
  items,
  note,
  attachmentNames,
}: OrderFormReceivedProps) {
  return (
    <Html lang="hu">
      <Head />
      <Preview>Megrendelésed megérkezett – Varázskép</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Köszönjük a megrendelésed!</Heading>

          <Text style={text}>Kedves {customerName}!</Text>

          <Text style={text}>
            Megrendelésedet megkaptuk. Hamarosan felvesszük veled a kapcsolatot a
            részletek, a végösszeg és az átvétel egyeztetése miatt.
          </Text>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Megrendelés azonosítója</Text>
            <Text style={value}>{orderId}</Text>

            {items.length > 0 && (
              <>
                <Text style={label}>Termékek</Text>
                {items.map((item, i) => (
                  <Text key={i} style={value}>
                    {item.description} × {item.quantity}
                  </Text>
                ))}
              </>
            )}

            <Text style={label}>Megrendelés szövege</Text>
            <Text style={preformatted}>{note}</Text>

            {attachmentNames.length > 0 && (
              <>
                <Text style={label}>Csatolt fájlok</Text>
                {attachmentNames.map((name, i) => (
                  <Text key={i} style={value}>
                    {name}
                  </Text>
                ))}
              </>
            )}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Kérdés esetén keress minket a varazskep.hu oldalon.
          </Text>
          <Text style={footer}>Varázs-kép Kft. – Dunaújváros</Text>
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
  margin: "0 0 12px",
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

const footer: React.CSSProperties = {
  color: "#6c757d",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};
