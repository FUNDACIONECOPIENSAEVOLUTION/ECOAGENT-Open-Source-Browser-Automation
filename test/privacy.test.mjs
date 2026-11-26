import test from 'node:test';import assert from 'node:assert/strict';import {profilePath,safeUrl,sensitiveField} from '../privacy.mjs';
test('perfil traversal',()=>assert.throws(()=>profilePath('/tmp','../other')));
test('url sin query ni fragmento',()=>assert.equal(safeUrl('https://example.org/a?token=x#y'),'https://example.org/a'));
test('campos sensibles',()=>{assert.equal(sensitiveField({type:'password'}),true);assert.equal(sensitiveField({autocomplete:'one-time-code'}),true);assert.equal(sensitiveField({label:'Nombre'}),false)});
