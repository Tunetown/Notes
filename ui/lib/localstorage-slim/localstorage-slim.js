!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.ls=e():t.ls=e()}(this,(function(){return(()=>{"use strict";var t={d:(e,r)=>{for(var n in r)t.o(r,n)&&!t.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:r[n]})},o:(t,e)=>Object.prototype.hasOwnProperty.call(t,e)},e={};t.d(e,{default:()=>u});const r=(...t)=>{},n=t=>null!==t&&"Object"===t.constructor.name;let o;const c=()=>{if(void 0!==o)return o;o=!0;try{localStorage||(o=!1)}catch{o=!1}return s(),o},l=String.fromCharCode(0),a=(t,e,r=!0)=>r?[...JSON.stringify(t)].map((t=>String.fromCharCode(t.charCodeAt(0)+e))).join(""):JSON.parse([...t].map((t=>String.fromCharCode(t.charCodeAt(0)-e))).join("")),p={ttl:null,encrypt:!1,encrypter:a,decrypter:(t,e)=>a(t,e,!1),secret:75},s=(t=!1)=>{if(!c())return!1;Object.keys(localStorage).forEach((e=>{const r=localStorage.getItem(e);if(!r)return;let o;try{o=JSON.parse(r)}catch{return}n(o)&&l in o&&(Date.now()>o.ttl||t)&&localStorage.removeItem(e)}))},u={config:p,set:(t,e,n={})=>{if(!c())return!1;const o={...p,...n,encrypt:!1!==n.encrypt&&(n.encrypt||p.encrypt),ttl:null===n.ttl?null:n.ttl||p.ttl};try{const n=o.ttl&&!isNaN(o.ttl)&&o.ttl>0;let c=n?{[l]:e,ttl:Date.now()+1e3*o.ttl}:e;o.encrypt&&(n?c[l]=(o.encrypter||r)(c[l],o.secret):c=(o.encrypter||r)(c,o.secret)),localStorage.setItem(t,JSON.stringify(c))}catch{return!1}},get:(t,e={})=>{if(!c())return null;const o=localStorage.getItem(t);if(!o)return null;const a={...p,...e,encrypt:!1!==e.encrypt&&(e.encrypt||p.encrypt),ttl:null===e.ttl?null:e.ttl||p.ttl};let s=JSON.parse(o);const u=n(s)&&l in s;if(a.decrypt||a.encrypt)try{u?s[l]=(a.decrypter||r)(s[l],a.secret):s=(a.decrypter||r)(s,a.secret)}catch{}return u?Date.now()>s.ttl?(localStorage.removeItem(t),null):s[l]:s},flush:s,clear:()=>{if(!c())return!1;localStorage.clear()},remove:t=>{if(!c())return!1;localStorage.removeItem(t)}};return e.default})()}));
//# sourceMappingURL=localstorage-slim.js.map