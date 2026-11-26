import {resolve} from 'node:path';
export function profilePath(home,id){if(!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id))throw Error('Nombre de perfil inválido');return resolve(home,'profiles',id)}
export function safeUrl(raw){try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol))return u.protocol;return u.origin+u.pathname}catch{return ''}}
export function sensitiveField(f){return /password|file|hidden/i.test(f.type||'')||/password|one-time-code|cc-|webauthn|username/i.test(f.autocomplete||'')||/password|passwd|contrase|otp|verification.code|security.code|secret|token|pin.code/i.test([f.label,f.name].join(' '))}
