import {readURL} from './desktop-policy.mjs';
export function authEndpoint(form,origin){
 if(form.method!=='post'||form.override||(form.target&&form.target!=='_self'))throw Error('Unsupported native authentication form');
 const u=readURL(form.action);if(u.origin!==origin)throw Error('Authentication origin not approved');return u.href;
}
export function safeAuthRedirect(location,source,status){
 if(![302,303].includes(status)||!location)return null;
 try{const a=readURL(source),b=readURL(new URL(location,a).href);return a.origin===b.origin?b.href:null}catch{return null}
}
