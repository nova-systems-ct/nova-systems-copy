import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, ArrowRight } from "lucide-react";
import { Field, TextInput, GOLD, G, inp } from "./ui";

const cardElementOptions = {
  style: {
    base: { color: "#fff", fontSize: "14px", fontFamily: "inherit", "::placeholder": { color: "rgba(255,255,255,0.35)" } },
    invalid: { color: "#e05252" },
  },
};

function SkipModal({ onAddCard, onSkip }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#141210", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 28 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>A payment method is required to reserve your spot.</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 22 }}>
          You will not be charged today. Adding a card now simply reserves your place in the onboarding queue.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={onAddCard} style={{ padding: "13px", borderRadius: 8, border: "none", background: G, color: "#0a0800", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
            Add Card
          </button>
          <button type="button" onClick={onSkip} style={{ padding: "13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSection({ form, onContinue }) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState(form.name || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSkipModal, setShowSkipModal] = useState(false);

  const attemptCard = async () => {
    if (!stripe || !elements) {
      onContinue({ stripe_customer_id: "", stripe_payment_method_id: "", no_card_on_file: true });
      return;
    }
    const card = elements.getElement(CardElement);
    setSubmitting(true);
    setError("");
    try {
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: "card", card, billing_details: { name: cardholderName || form.name, email: form.email },
      });
      if (pmError) throw new Error(pmError.message || "Your card details could not be verified.");

      const res = await fetch("/api/stripe?action=setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: cardholderName || form.name, payment_method_id: paymentMethod.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "We could not save your payment method.");

      onContinue({ stripe_customer_id: data.customer_id || "", stripe_payment_method_id: data.payment_method_id || "", no_card_on_file: false });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const handleContinueClick = () => {
    const card = elements?.getElement(CardElement);
    if (!card || !cardholderName.trim()) {
      setShowSkipModal(true);
      return;
    }
    attemptCard();
  };

  const skipEntirely = () => {
    setShowSkipModal(false);
    onContinue({ stripe_customer_id: "", stripe_payment_method_id: "", no_card_on_file: true });
  };

  return (
    <>
      {showSkipModal && <SkipModal onAddCard={() => setShowSkipModal(false)} onSkip={skipEntirely} />}

      <div style={{ borderRadius: 12, border: `1px solid ${GOLD}33`, padding: 18, marginBottom: 4, textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Due Today</p>
        <p style={{ fontSize: 32, fontWeight: 900, color: GOLD }}>$0.00</p>
      </div>

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>What happens after you submit</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "We run Nova Audit on your business.",
            "We research your company and competitors.",
            "We build your custom proposal.",
            "We prepare your implementation plan.",
            "We schedule your strategy meeting.",
          ].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: GOLD, fontSize: 13, lineHeight: 1.4 }}>✅</span>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Cancellation Policy</p>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>
          No payment is due today. If you authorize work to begin and cancel after the 10 day review period, an
          administrative fee of up to $25 may apply as described in the Service Agreement.
        </p>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Lock style={{ width: 14, height: 14, color: GOLD }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Secure Payment Method</span>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
          To reserve your place in our onboarding queue, please add a payment method below. You will not be
          charged anything today. A charge will only occur after you review and approve your proposal and sign
          a service agreement.
        </p>

        {stripe && elements ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Cardholder Name">
              <TextInput value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="Name on card" />
            </Field>
            <div style={{ ...inp, padding: "16px" }}>
              <CardElement options={cardElementOptions} />
            </div>
          </div>
        ) : (
          <p style={{ color: "#e0a552", fontSize: 12 }}>
            Payment collection is not configured yet — you can still continue and we'll follow up to collect payment details.
          </p>
        )}
      </div>

      {error && <p style={{ color: "#e05252", fontSize: 12.5 }}>{error}</p>}

      <button
        type="button"
        onClick={handleContinueClick}
        disabled={submitting}
        style={{
          width: "100%", padding: "18px", fontSize: 13, fontWeight: 800,
          letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          background: submitting ? "#5a4d1e" : G, color: "#0a0800",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit",
        }}
      >
        {submitting ? "Saving..." : <>Continue <ArrowRight style={{ width: 14, height: 14 }} /></>}
      </button>
    </>
  );
}
