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

// Signed /sign/:contract_id agreement — full contract text plus the client's
// typed name, drawn signature, and signing date. Attached to both the client's
// and Isaac's confirmation emails and stored in the nova-vault bucket.
export function generateSignedContractPDF({ title, intro, sections, clientName, signedName, signatureDataUrl, signedDate }) {
  const doc = new jsPDF()
  header(doc, title)

  let y = 54
  if (intro) y = addSection(doc, '', intro, y)
  for (const s of sections || []) {
    y = addSection(doc, s.heading, s.body, y)
  }

  if (y > 230) { doc.addPage(); y = 24 }
  y += 4
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(14, y, 196, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text('Signed By', 14, y)
  y += 8

  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, 'PNG', 14, y, 70, 24) } catch { /* ignore malformed image */ }
    y += 28
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(60, 60, 60)
  doc.text(`${signedName || clientName || ''}`, 14, y)
  y += 6
  doc.text(`Date: ${signedDate || new Date().toLocaleDateString()}`, 14, y)

  footer(doc, title)
  return doc
}

// Gold rule + all-caps label marking the start of a new assessment section.
function sectionHeading(doc, text, y) {
  if (y > 260) { doc.addPage(); y = 24 }
  y += 4
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(14, y, 196, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...GOLD)
  doc.text(text.toUpperCase(), 14, y)
  y += 8
  return y
}

// Renders every checked item in a checklist-with-details section (marketing /
// technology / communication) as one line, e.g. "Instagram (frequency: Daily, happy: Yes)".
function checklistSummary(obj) {
  const entries = Object.entries(obj || {}).filter(([, v]) => v?.active)
  if (!entries.length) return 'None selected'
  return entries.map(([label, v]) => {
    const details = Object.entries(v).filter(([k]) => k !== 'active' && v[k])
      .map(([k, dv]) => `${k}: ${dv}`).join(', ')
    return details ? `${label} (${details})` : label
  }).join('\n')
}

// Full Q&A summary of a /intake (Nova Business Intelligence Assessment) submission,
// attached to the confirmation email and offered as a download on the success screen.
export function generateIntakeSummaryPDF(data) {
  const doc = new jsPDF()
  header(doc, 'Business Intelligence Assessment')

  let y = 54
  const row = (label, value) => { y = addSection(doc, label, value || '(not provided)', y) }

  y = sectionHeading(doc, '1. About You', y)
  row('Full Name', data.name)
  row('Email', data.email)
  row('Phone', data.phone)
  row('Best Time to Contact', data.best_time)
  row('Preferred Contact Method', data.preferred_contact)

  y = sectionHeading(doc, '2. Your Business', y)
  ;(data.businesses || []).forEach((biz, i) => {
    row(`Business ${i + 1}`, [biz.business_name, biz.industry].filter(Boolean).join(' — '))
    row('Address', biz.address)
    row('Website', biz.website)
    row('Years in Business', biz.years_in_business)
    row('Employees', biz.employee_count)
    row('Locations', biz.locations)
    row('Monthly Revenue', biz.monthly_revenue)
  })

  const story = data.story || {}
  y = sectionHeading(doc, '3. Your Story', y)
  row('Business Story', story.business_story)
  row('Why Started', story.why_started)
  row('Differentiation', story.differentiation)
  row('Strengths', story.strengths)
  row('Weaknesses', story.weaknesses)
  row('Proudest', story.proudest)
  row('Compliments', story.compliments)
  row('Frustrations', story.frustrations)

  const goals = data.goals || {}
  y = sectionHeading(doc, '4. Your Goals', y)
  row('12-Month Revenue Goal', goals.revenue_goal_12mo)
  row('Customer Goal', goals.customer_goal)
  row('Employee Goal', goals.employee_goal)
  row('Biggest Challenge', goals.biggest_challenge)
  row('Biggest Opportunity', goals.biggest_opportunity)
  row('One Problem to Solve', goals.one_problem_to_solve)
  row('Success in 1 Year', goals.success_1yr)
  row('Success in 3 Years', goals.success_3yr)

  const customers = data.customers || {}
  y = sectionHeading(doc, '5. Your Customers', y)
  row('Ideal Customer', customers.ideal_customer)
  row('Not Ideal Customer', customers.not_ideal_customer)
  row('Average Age Range', customers.avg_age_range)
  row('Geography', customers.geography)
  row('Average Order Value', customers.avg_order_value)
  row('Repeat or One-Time', customers.repeat_or_one_time)
  row('Why They Buy', customers.why_buy)
  row('Why They Leave', customers.why_leave)
  row('Objections', customers.objections)
  row('Lose Customers To', customers.lose_to)

  y = sectionHeading(doc, '6. Products & Services', y)
  ;(data.services || []).forEach((svc, i) => {
    row(`Service ${i + 1}`, [svc.name, svc.price].filter(Boolean).join(' — '))
    row('Best Seller', svc.best_seller)
    row('Highest Profit', svc.highest_profit)
    row('Wish Sold More', svc.wish_sold_more)
    row('Seasonal', svc.seasonal)
    row('Delivery Time', svc.delivery_time)
    row('Upsells', svc.upsells)
    row('Common Questions', svc.common_questions)
  })

  const sp = data.sales_process || {}
  y = sectionHeading(doc, '7. Sales Process', y)
  row('Journey', sp.journey)
  row('How Found', sp.how_found)
  row('After Call', sp.after_call)
  row('After Email', sp.after_email)
  row('After Form', sp.after_form)
  row('Who Follows Up', sp.who_follows_up)
  row('Follow-Up Time', sp.follow_up_time)
  row('Software Used', sp.software_used)
  row('People Involved', sp.people_involved)
  row('Where Leads Disappear', sp.where_leads_disappear)

  y = sectionHeading(doc, '8. Marketing', y)
  row('Platforms', checklistSummary(data.marketing))

  y = sectionHeading(doc, '9. Technology', y)
  row('Tools', checklistSummary(data.technology))

  y = sectionHeading(doc, '10. Communication', y)
  row('Channels', checklistSummary(data.communication))

  const team = data.team || {}
  y = sectionHeading(doc, '11. Team', y)
  row('Full Time Employees', team.full_time_count)
  row('Part Time Employees', team.part_time_count)
  row('Who Answers Phones', team.who_answers_phones)
  row('Who Replies to Emails', team.who_replies_emails)
  row('Who Handles Social', team.who_handles_social)
  row('Who Books Appointments', team.who_books_appointments)
  row('Biggest Time Waster', team.biggest_time_waster)
  row('Biggest Training Issue', team.biggest_training_issue)
  row('Well Trained', team.well_trained)
  row('Hire First For', team.hire_first_for)

  const rep = data.reputation || {}
  y = sectionHeading(doc, '12. Reputation', y)
  row('Google Rating', rep.google_rating)
  row('Google Review Count', rep.google_review_count)
  row('Facebook Rating', rep.facebook_rating)
  row('Common Complaint', rep.common_complaint)
  row('Common Compliment', rep.common_compliment)
  row('Review Ask Method', rep.review_ask_method)
  row('Respond to Reviews', rep.respond_to_reviews)
  row('Lost Customer to Review', rep.lost_customer_to_review)

  const fin = data.financials || {}
  y = sectionHeading(doc, '13. Financial Snapshot', y)
  row('Monthly Revenue Range', fin.monthly_revenue_range)
  row('Average Sale Range', fin.avg_sale_range)
  row('New Customers / Month', fin.new_customers_per_month)
  row('Repeat Customers / Month', fin.repeat_customers_per_month)
  row('Marketing Budget', fin.marketing_budget)
  row('Biggest Expense', fin.biggest_expense)
  row('Highest Profit Item', fin.highest_profit_item)
  row('Lowest Profit Item', fin.lowest_profit_item)

  const comp = data.competitors || {}
  y = sectionHeading(doc, '14. Competitors', y)
  row('Listed Competitors', (comp.list || []).map((c) => [c.name, c.website].filter(Boolean).join(' — ')).filter(Boolean).join('\n'))
  row('Admire Who', comp.admire_who)
  row('Admire Why', comp.admire_why)
  row('Biggest Threat', comp.threat_who)
  row('Threat Why', comp.threat_why)
  row('What They Do Better', comp.what_they_do_better)
  row('What We Do Better', comp.what_we_do_better)
  row('Path to #1', comp.path_to_number_one)

  const ai = data.ai_knowledge || {}
  y = sectionHeading(doc, '15. AI Knowledge Base', y)
  row('Pricing', ai.pricing)
  row('Policies', ai.policies)
  row('Guarantees', ai.guarantees)
  row('Refund Policy', ai.refund_policy)
  row('Common Q&A', ai.common_qa)
  row('Brand Personality', ai.brand_personality)
  row('Never Say', ai.never_say)
  row('Always Say', ai.always_say)
  row('Hours', ai.hours)
  row('Emergency Contact', ai.emergency_contact)

  y = sectionHeading(doc, '16. Document Uploads', y)
  const docCount = Object.values(data.document_urls || {}).reduce((n, arr) => n + (arr?.length || 0), 0)
  row('Files Uploaded', `${docCount} file${docCount === 1 ? '' : 's'}`)

  const fq = data.final_questions || {}
  y = sectionHeading(doc, '17. Final Questions', y)
  row('Fix One Thing', fq.fix_one_thing)
  row('Losing Money Where', fq.losing_money_where)
  row('Time Waster', fq.time_waster)
  row('Extra Employee Task', fq.extra_employee_task)
  row('Phone 50 More Calls', fq.phone_50_more_calls)
  row('Secret Shopper Criticism', fq.secret_shopper_criticism)
  row('Keeps Up At Night', fq.keeps_up_at_night)
  row('Tried Before', fq.tried_before)
  row('Worth It Definition', fq.worth_it_definition)

  y = sectionHeading(doc, '19. Reserve Your Spot', y)
  row('Card on File', data.no_card_on_file ? 'No' : 'Yes')

  y = sectionHeading(doc, '20. Agreements & Signature', y)
  row('Signed By', data.digital_signature)
  row('Signature Date', data.signature_date)
  if (data.signature_image) {
    if (y > 250) { doc.addPage(); y = 24 }
    try { doc.addImage(data.signature_image, 'PNG', 14, y, 70, 24) } catch { /* ignore malformed image */ }
    y += 30
  }

  footer(doc, 'Business Intelligence Assessment')
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
