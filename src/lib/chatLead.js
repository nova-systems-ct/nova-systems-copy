const FIELDS = ['name','business','challenge','day','email'];
export function captureLeadAnswer(data, step, answer) {
  const field=FIELDS[step];const value=String(answer||'').trim();
  if(!field||!value)return {error:'Enter an answer to continue.'};
  if(field==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return {error:'Enter a valid email address.'};
  return {data:{...data,[field]:value.slice(0,field==='challenge'?2000:field==='email'?254:200)},complete:step===FIELDS.length-1,nextStep:step+1};
}
export function contactLeadPayload(data) {
  return {name:data.name,email:data.email,company:data.business,category:'sales',subject:`Nova inquiry: ${data.name}`,message:`Business: ${data.business}\nGoal or challenge: ${data.challenge}\nPreferred day (not a booking): ${data.day}`};
}
