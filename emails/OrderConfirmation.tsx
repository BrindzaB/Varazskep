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

interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  productName: string;
  variantColor: string;
  variantSize: string;
  totalAmount: string; // pre-formatted, e.g. "4 990 Ft"
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
  };
  shippingMethod: "FOXPOST_LOCKER" | "MPL_HOME_DELIVERY";
  shippingCost: string; // pre-formatted, e.g. "990 Ft"
  pickupPointName?: string;
  pickupPointAddress?: string;
}

export default function OrderConfirmation({
  customerName,
  orderId,
  productName,
  variantColor,
  variantSize,
  totalAmount,
  shippingAddress,
  shippingMethod,
  shippingCost,
  pickupPointName,
  pickupPointAddress,
}: OrderConfirmationProps) {
  const isFoxpost = shippingMethod === "FOXPOST_LOCKER";

  return (
    <Html lang="hu">
      <Head />
      <Preview>Rendelésed megérkezett – Varázskép</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Köszönjük a rendelésed!</Heading>

          <Text style={text}>
            Kedves {customerName}!
          </Text>

          <Text style={text}>
            Rendelésedet megkaptuk és hamarosan elkezdjük a feldolgozást.
          </Text>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Rendelés azonosítója</Text>
            <Text style={value}>{orderId}</Text>

            <Text style={label}>Termék</Text>
            <Text style={value}>
              {productName} – {variantColor}, {variantSize}
            </Text>

            <Text style={label}>Végösszeg</Text>
            <Text style={value}>{totalAmount}</Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Szállítási mód</Text>
            <Text style={value}>
              {isFoxpost ? "Foxpost csomagautomata" : "MPL házhozszállítás"} – {shippingCost}
            </Text>

            {isFoxpost && pickupPointName ? (
              <>
                <Text style={label}>Átvételi pont</Text>
                <Text style={value}>
                  {pickupPointName}
                  {pickupPointAddress ? `\n${pickupPointAddress}` : ""}
                </Text>
              </>
            ) : (
              <>
                <Text style={label}>Szállítási cím</Text>
                <Text style={value}>
                  {shippingAddress.postalCode} {shippingAddress.city},{" "}
                  {shippingAddress.address}
                </Text>
              </>
            )}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Kérdés esetén keress minket a varazskep.hu oldalon.
          </Text>
          <Text style={footer}>
            Varázs-kép Kft. – Dunaújváros
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
