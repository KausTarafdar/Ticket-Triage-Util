// First match wins: specific and severe patterns come before broad ones.
const RULES = [
  [/unsubscribe|claim your prize|bank details|out of office|away until|congratulations/, 'not_support', 'low', 'Spam, newsletter or auto-reply'],
  [/suspicious login|unauthori[sz]ed|compromis|hacked/, 'security', 'critical', 'Possible account compromise'],
  [/data deleted|records are now gone|no backup/, 'data_integrity', 'critical', 'Customer data lost'],
  [/sso login broken|\b500\b|checkout is down|webhook|production|whole team|40 people/, 'outage', 'critical', 'Production or a whole team is affected'],
  [/search returns no results|nothing at all/, 'outage', 'high', 'Core feature returning nothing'],
  [/log in|login|locked out|password reset|2fa|sms code|unlock/, 'account_access', 'high', 'User blocked from the product'],
  [/charged twice|refund not received|wrong gst|gstin|did not add|declined/, 'billing', 'high', 'Money or entitlements are wrong'],
  [/duplicate records|wrong totals|doesn't match/, 'data_integrity', 'medium', 'Data looks wrong'],
  [/invoice|refund|card|payment|seat|pricing|downgrade|upgrade|trial|billing/, 'billing', 'low', 'Billing or plan question'],
  [/request|would love|would be great|any plans|can we get|please add|allow custom|role-based/, 'feature_request', 'low', 'Asks for something new'],
  [/how do i|where do i|walk us through|is there a|api docs|invite/, 'how_to', 'low', 'Usage or setup question'],
  [/crash|freeze|late|timezone|fail|empty file|filters/, 'bug', 'medium', 'Misbehaving but a workaround exists'],
];

function classifyByRules(tickets) {
  const results = new Map();
  for (const t of tickets) {
    const text = `${t.subject} ${t.body ?? ''}`.toLowerCase();
    const hit = RULES.find(([re]) => re.test(text));
    const [, category, urgency, reason] = hit ?? [null, 'bug', 'medium', 'No rule matched, needs a manual look'];
    results.set(t.ticket_id, { ticket_id: t.ticket_id, category, urgency, urgency_reason: reason });
  }
  return results;
}

export { classifyByRules };
