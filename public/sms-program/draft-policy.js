// Model words are never booking authority. These checks run before displaying/saving a candidate.
const UNSUPPORTED_FACT=/(?:\$\s*\d|\b(?:USD|dollars?|guarantee|complimentary)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b\d{4}-\d{2}-\d{2}\b|\[(?:date|time|customer|business owner|name)[^\]]*\]|https?:\/\/|\b(?:i(?:'ve| have)|we(?:'ve| have))\s+(?:sent|booked|confirmed|scheduled|charged|completed)\b)/i;
const templates={
 intake:input=>'Request for Nova Systems: '+input.trim().slice(0,1800),
 scheduling:()=> 'Thanks for reaching out to Nova Systems. Which day and time would suit you for a phone introduction?',
 follow_up:()=> 'Thanks for reaching out to Nova Systems about improving your business systems. Which part of handling customer requests or booking appointments would you like us to work through first?',
};
export function protectDraft(agent,input,candidate,facts={}){
 if(agent==='scheduling'&&facts.state==='booked'&&Number.isFinite(Date.parse(facts.starts_at))){const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(facts.starts_at));return{text:'Your phone introduction with Nova Systems is reserved for '+time+'. Nova will call the phone number provided.',output_mode:'verified_template',review_note:'This response uses the saved booking facts, not a model-invented time.'};}
 const raw=String(candidate||'').trim();
 const needsTemplate=!raw||UNSUPPORTED_FACT.test(raw);
 if(needsTemplate)return {text:(templates[agent]||templates.intake)(input),output_mode:'verified_template',review_note:'The model draft contained unsupported details. A labelled template is shown instead.'};
 // Keep complete sentences, rather than publishing a truncated final fragment.
 const sentences=raw.match(/[^.!?]+[.!?](?:["”])?/g);
 const text=sentences?.length?sentences.slice(0,3).join(' ').trim():raw;
 return {text,output_mode:'language_model_draft',review_note:'Review the generated draft before using it. No action was dispatched.'};
}
