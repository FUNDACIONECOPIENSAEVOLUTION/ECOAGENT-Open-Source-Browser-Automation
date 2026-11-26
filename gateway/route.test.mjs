import test from 'node:test';import assert from 'node:assert/strict';import {allowedRoute} from './route.mjs';
test('only MCP and OAuth metadata exposed',()=>{assert.equal(allowedRoute('POST','/mcp'),true);assert.equal(allowedRoute('GET','/.well-known/oauth-protected-resource/mcp'),true);for(const p of ['/','/health','/api/jobs','/api/screen','/api/v1/batch','/mcp?x=1'])assert.equal(allowedRoute('POST',p),false)});
test('reject unsupported method',()=>assert.equal(allowedRoute('DELETE','/mcp'),false));
