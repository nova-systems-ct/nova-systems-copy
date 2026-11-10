// The launch is $0 by default. Enabling billable dispatch requires an explicit later budget decision.
export function billableDispatchEnabled(env=process.env){return env.NOVA_SPENDING_LOCK==='disabled'&&env.NOVA_BILLABLE_DISPATCH_ENABLED==='true';}
export function requireBillableDispatch(env=process.env){if(!billableDispatchEnabled(env)){const e=new Error('Billable dispatch is paused under the $0 launch policy. Use the on-device workers and web booking.');e.code='spending_locked';e.status=423;throw e;}}
