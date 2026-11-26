import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from './tools.mjs';
const backend={health:async()=>({ok:true}),read:async()=>({id:'demo',status:'running'}),status:async()=>({status:'completed'})};
const server=createServer(backend);
const client=new Client({name:'ecoagent-integration-test',version:'1.0.0'});
const [a,b]=InMemoryTransport.createLinkedPair();
try {
 await server.connect(a);await client.connect(b);
 const result=await client.listTools();
 assert.equal(result.tools.length,3);
 const health=await client.callTool({name:'ecoagent_health',arguments:{}});
 assert.equal(health.isError??false,false);
 assert.equal(JSON.parse(health.content[0].text).ok,true);
 const read=await client.callTool({name:'ecoagent_read_public',arguments:{url:'https://example.org/'}});
 assert.equal(read.isError??false,false);
 assert.equal(JSON.parse(read.content[0].text).id,'demo');
 console.log('SDK + Zod integration OK (mock backend)');
}finally{await client.close();await server.close()}
