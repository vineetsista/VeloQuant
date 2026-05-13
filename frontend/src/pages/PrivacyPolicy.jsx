import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 28px 80px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 32, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back
        </button>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Legal</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, marginBottom: 10 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: 0 }}>Last updated: May 13, 2026</p>
        </div>

        <div style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-2)' }}>

          <Section title="1. Overview">
            RIA Intelligence ("we," "us," or "our") operates the RIA Intelligence platform, a morning briefing and portfolio monitoring service for registered investment advisors. This Privacy Policy explains how we collect, use, and protect your information when you use our platform at riaplatform-production.up.railway.app (the "Service").
          </Section>

          <Section title="2. Information We Collect">
            <b style={{ color: 'var(--text)' }}>Account Information:</b> When you create an account, we collect your name, firm name, email address, and a hashed password. We do not store plaintext passwords.
            <br /><br />
            <b style={{ color: 'var(--text)' }}>Portfolio Data:</b> We collect ticker symbols and position sizes you enter. We do not collect or store brokerage credentials, account numbers, or full portfolio valuations beyond what you manually enter.
            <br /><br />
            <b style={{ color: 'var(--text)' }}>Usage Data:</b> We may collect standard server logs including IP addresses, browser type, pages visited, and timestamps for security and debugging purposes.
            <br /><br />
            <b style={{ color: 'var(--text)' }}>Payment Information:</b> Billing is processed by Stripe, Inc. We do not store credit card numbers or payment details on our servers. Stripe's privacy policy governs their data handling.
          </Section>

          <Section title="3. How We Use Your Information">
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>To deliver your daily morning intelligence briefings via email</li>
              <li style={{ marginBottom: 8 }}>To monitor SEC filings and generate alerts for your tracked holdings</li>
              <li style={{ marginBottom: 8 }}>To process subscription payments through Stripe</li>
              <li style={{ marginBottom: 8 }}>To send transactional emails (verification, password reset, briefings)</li>
              <li style={{ marginBottom: 8 }}>To improve the platform and debug issues</li>
              <li style={{ marginBottom: 8 }}>To comply with legal obligations</li>
            </ul>
            We do not sell your personal information to third parties. We do not use your portfolio data for any purpose other than generating your briefings and alerts.
          </Section>

          <Section title="4. Data Sharing">
            We share data only with:
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}><b style={{ color: 'var(--text)' }}>Anthropic:</b> AI-generated briefing content is processed via Anthropic's Claude API. Portfolio tickers and position data are included in prompts.</li>
              <li style={{ marginBottom: 8 }}><b style={{ color: 'var(--text)' }}>Stripe:</b> Subscription and billing management.</li>
              <li style={{ marginBottom: 8 }}><b style={{ color: 'var(--text)' }}>SendGrid:</b> Email delivery service for briefings and transactional emails.</li>
              <li style={{ marginBottom: 8 }}><b style={{ color: 'var(--text)' }}>Polygon.io:</b> Market price data retrieval for your tracked tickers.</li>
              <li style={{ marginBottom: 8 }}><b style={{ color: 'var(--text)' }}>SEC EDGAR:</b> Public filing data retrieval. No personal data is sent to the SEC.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            We retain your account data for as long as your account is active. If you cancel your subscription and delete your account, we will delete your personal data within 30 days, except where retention is required by law.
            <br /><br />
            Briefing content and filing alerts are retained for up to 12 months to support your historical review.
          </Section>

          <Section title="6. Security">
            We use industry-standard practices including encrypted connections (HTTPS/TLS), hashed passwords (bcrypt), and role-based access controls. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="7. Your Rights">
            You may request access to, correction of, or deletion of your personal data by emailing us. You may also export your holdings data at any time from the Holdings page.
          </Section>

          <Section title="8. Cookies">
            We do not use tracking cookies or third-party advertising cookies. Session state is stored in your browser's localStorage and is not transmitted to third parties.
          </Section>

          <Section title="9. Investment Data Disclaimer">
            The information processed through this platform relates to publicly available market data and SEC filings. We are not a registered investment advisor. Nothing in this platform constitutes investment advice. See our full <button onClick={() => navigate('/disclaimer')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 14.5, textDecoration: 'underline' }}>Disclaimer</button> for details.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify registered users of material changes by email. Continued use of the Service after changes constitutes acceptance of the updated policy.
          </Section>

          <Section title="11. Contact">
            For privacy inquiries, contact us at: <span style={{ color: 'var(--accent)' }}>vineet.sista@gmail.com</span>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, marginTop: 0 }}>{title}</h2>
      <div>{children}</div>
    </div>
  )
}
