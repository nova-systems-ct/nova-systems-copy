import { setCors } from './_cors.js';
import { handleAcademy } from './_sales/academy.js';

// Nova Sales Academy — thin entry point. All logic (server-side grading, attempt policy, practical review, certificates)
// lives in api/_sales/academy.js so it is unit-testable and shares the Sales Team platform's authorization helpers.
// Every academy_* table is reached only through that module with the service role; answer keys are never returned.
// Actions: programs, program-detail, my-enrollments, enroll, complete-lesson, submit-exercise, submit-quiz,
// submit-practical, issue-certificate, certificate-pdf, verify-certificate (public), admin-overview, practical-queue,
// review-practical, policy, save-policy, approve-policy, approve-content, reset-attempts, critical-review, revoke-certificate.
export default async function handler(req, res) {
  if (setCors(req, res)) return;
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  return handleAcademy(req, res, action);
}
