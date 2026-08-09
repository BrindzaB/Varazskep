import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PickupReadyProps {
  customerName: string;
  courierLabel: string; // e.g. "Packeta", "Foxpost"
  pointName?: string; // pickup point display name
  pointAddress?: string; // pickup point address
  trackingNumber: string;
  trackingLink: string; // Kvikk tracking page URL
}

export default function PickupReady({
  customerName,
  courierLabel,
  pointName,
  pointAddress,
  trackingNumber,
  trackingLink,
}: PickupReadyProps) {
  return (
    <Html lang="hu">
      <Head />
      <Preview>Csomagod átvehető – Varázskép</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Csomagod átvehető!</Heading>

          <Text style={text}>Kedves {customerName}!</Text>

          <Text style={text}>
            Csomagod megérkezett a(z) {courierLabel} átvételi pontra, és készen
            áll az átvételre. Kérjük, vedd át a megadott határidőn belül.
          </Text>

          {(pointName || pointAddress) && (
            <Section style={pointBox}>
              <Text style={label}>Átvételi pont</Text>
              {pointName && <Text style={value}>{pointName}</Text>}
              {pointAddress && <Text style={value}>{pointAddress}</Text>}
            </Section>
          )}

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button style={button} href={trackingLink}>
              Csomag követése
            </Button>
          </Section>

          <Section>
            <Text style={label}>Nyomonkövetési azonosító</Text>
            <Text style={value}>{trackingNumber}</Text>
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

const pointBox: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  border: "1px solid #e9ecef",
  borderRadius: "4px",
  margin: "16px 0",
  padding: "16px 20px",
};

const button: React.CSSProperties = {
  backgroundColor: "#0fa0e4",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 24px",
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
