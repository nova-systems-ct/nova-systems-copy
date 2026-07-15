import { jsPDF } from 'jspdf'

const GOLD = [212, 160, 48]
const DARK = [10, 8, 0]

function header(doc, title) {
  doc.setFillColor(...DARK)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('NOVA SYSTEMS', 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('nova-systems.app  ·  hello@nova-systems.app  ·  Waterbury, CT', 14, 23)
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 44)
}

function footer(doc, pageLabel) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Nova Systems  ·  nova-systems.app  ·  ${pageLabel}`, 14, 290)
    doc.text(`Page ${i} of ${pageCount}`, 182, 290)
  }
}

// Adds a heading + wrapped body paragraph, paginating as needed. Returns the new y.
function addSection(doc, heading, body, y) {
  if (y > 265) { doc.addPage(); y = 24 }
  if (heading) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text(heading, 14, y)
    y += 7
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60, 60, 60)
  const lines = doc.splitTextToSize(String(body || ''), 182)
  for (const line of lines) {
    if (y > 280) { doc.addPage(); y = 24 }
    doc.text(line, 14, y)
    y += 5.2
  }
  return y + 6
}

// Generic legal-document generator for /terms, /privacy, /service-agreement.
// sections: [{ heading, body }]
export function generateLegalPDF({ title, effectiveDate, sections }) {
  const doc = new jsPDF()
  header(doc, title)

  let y = 54
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Effective Date: ${effectiveDate || new Date().toLocaleDateString()}`, 14, y)
  y += 10

  for (const s of sections || []) {
    y = addSection(doc, s.heading, s.body, y)
  }

  footer(doc, title)
  return doc
}

// Full Q&A summary of an /intake submission, attached to the confirmation email.
export function generateIntakeSummaryPDF(data) {
  const doc = new jsPDF()
  header(doc, 'Business Intake Summary')

  let y = 54
  const row = (label, value) => { y = addSection(doc, label, value || '(not provided)', y) }

  row('Full Name', data.name)
  row('Email', data.email)
  row('Phone', data.phone)
  row('Preferred Contact Method', data.preferred_contact)
  row('Best Time to Contact', data.best_time)

  ;(data.businesses || []).forEach((biz, i) => {
    y = addSection(doc, `Business ${i + 1}: ${biz.business_name || ''}`, '', y)
    row('Industry', biz.industry)
    row('Address', biz.address)
    row('Website', biz.website)
    row('Time in Business', biz.time_in_business)
    row('Employees', biz.employee_count)
    row('Monthly Revenue', biz.monthly_revenue)
    row('Locations', biz.locations)
  })

  const sm = data.social_media || {}
  const platformLine = (p, key) => `${key}: ${sm[p]?.handle || '—'} (${sm[p]?.followers || '0'} followers)`
  row('Social Media', ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'twitter']
    .map((p) => platformLine(p, p[0].toUpperCase() + p.slice(1))).join('\n'))
  row('Paid Ads', sm.paid_ads?.running ? `Yes — ${sm.paid_ads.platforms || ''} ($${sm.paid_ads.spend || '0'}/mo)` : 'No')
  row('Google Business Profile', sm.google_business)
  row('Google Rating', sm.google_rating)

  const g = data.goals || {}
  row('Biggest Challenge', g.biggest_challenge)
  row('12-Month Revenue Goal', g.revenue_goal_12mo)
  row('3-Year Vision', g.dream_vision_3yr)
  row('Expansion Goals', g.expansion_goals)
  row('What Has Not Worked Before', g.tried_before)
  row('Why Reaching Out Now', g.why_now)

  row('Monthly Budget Range', data.budget_range)
  row('Start Timeline', data.timeline)
  row('Referral Source', data.referral_source)

  footer(doc, 'Business Intake Summary')
  return doc
}

export function generateInvoicePDF({ invoiceNumber, clientName, clientEmail, lineItems, subtotal, tax, total, dueDate, notes }) {
  const doc = new jsPDF()
  header(doc, `Invoice ${invoiceNumber}`)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Bill To: ${clientName || ''}`, 14, 56)
  if (clientEmail) doc.text(clientEmail, 14, 62)
  doc.text(`Due Date: ${dueDate || 'On receipt'}`, 140, 56)
  doc.text(`Invoice #: ${invoiceNumber}`, 140, 62)

  let y = 78
  doc.setFillColor(240, 240, 240)
  doc.rect(14, y - 6, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DESCRIPTION', 16, y)
  doc.text('QTY', 140, y)
  doc.text('AMOUNT', 166, y)
  y += 10

  doc.setFont('helvetica', 'normal')
  ;(lineItems || []).forEach((item) => {
    doc.text(String(item.description || ''), 16, y, { maxWidth: 120 })
    doc.text(String(item.quantity || 1), 140, y)
    doc.text(`$${(Number(item.amount) || 0).toFixed(2)}`, 166, y)
    y += 8
  })

  y += 4
  doc.line(14, y, 196, y)
  y += 8
  doc.text('Subtotal', 140, y)
  doc.text(`$${(subtotal || 0).toFixed(2)}`, 166, y)
  y += 7
  doc.text('Tax', 140, y)
  doc.text(`$${(tax || 0).toFixed(2)}`, 166, y)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total Due', 140, y)
  doc.text(`$${(total || 0).toFixed(2)}`, 166, y)

  if (notes) {
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('Notes:', 14, y)
    doc.text(String(notes), 14, y + 6, { maxWidth: 182 })
  }

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Payment instructions included via email. Thank you for your business.', 14, 285)

  return doc
}

export function generateContractPDF({ clientName, businessName, tierName, tierPrice, includedServices, signatureDataUrl, date }) {
  const doc = new jsPDF()
  header(doc, 'Service Agreement')

  let y = 56
  doc.setFontSize(10)
  doc.setTextColor(50, 50, 50)
  doc.setFont('helvetica', 'normal')
  doc.text(`This agreement is entered into on ${date || new Date().toLocaleDateString()} between Nova Systems ("Provider") and ${businessName || clientName} ("Client").`, 14, y, { maxWidth: 182 })
  y += 18

  doc.setFont('helvetica', 'bold')
  doc.text('1. Plan & Pricing', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text(`Client selects the ${tierName} plan at $${tierPrice}/month, billed monthly starting on the date of first payment.`, 14, y, { maxWidth: 182 }); y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('2. Included Services', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  ;(includedServices || []).forEach((s) => { doc.text(`•  ${s}`, 16, y); y += 6 })
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('3. Payment Terms', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text('Payment is due monthly on the anniversary of the first payment date. Late payments may result in suspension of services.', 14, y, { maxWidth: 182 }); y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('4. Cancellation Policy', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text('Either party may cancel this agreement with 30 days written notice. No refunds are issued for partial months of service.', 14, y, { maxWidth: 182 }); y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('5. Out of Scope', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text('Services not explicitly listed above are considered out of scope and may incur additional fees, to be agreed upon in writing.', 14, y, { maxWidth: 182 }); y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('6. Ownership', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text('Upon full payment, Client owns all final deliverables created specifically for Client. Nova Systems retains rights to underlying tools, templates, and methodologies.', 14, y, { maxWidth: 182 }); y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('7. Connecticut Tax Disclosure', 14, y); y += 7
  doc.setFont('helvetica', 'normal')
  doc.text('Applicable Connecticut sales tax will be added to invoices where required by law.', 14, y, { maxWidth: 182 }); y += 20

  if (y > 230) { doc.addPage(); y = 30 }

  doc.setFont('helvetica', 'bold')
  doc.text('Signature', 14, y); y += 6
  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, 'PNG', 14, y, 70, 24) } catch {}
    y += 28
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${clientName}  ·  ${date || new Date().toLocaleDateString()}`, 14, y)

  return doc
}
