import {sensitiveField} from '../privacy.mjs';
export function canDraft(f){return !!f&&!f.disabled&&!f.readOnly&&!sensitiveField(f)&&!/(?:credit|card.number|bank.account|social.security|document.number|identificaci|c[eé]dula|passport|pasaporte|tax.id)/i.test([f.name,f.label,f.autocomplete].join(' '))&&((f.tag==='input'&&['text','email','tel','url','number'].includes(f.type))||f.tag==='textarea'||f.tag==='select')}
export function validateDraft(f,value){if(!canDraft(f)||typeof value!=='string'||value.length>2000)throw Error('Field not approved for draft');return value}
export function findRef(snapshot,expected,refs,id){if(snapshot!==expected||!refs.has(id))throw Error('Stale or unknown element reference');return refs.get(id)}
