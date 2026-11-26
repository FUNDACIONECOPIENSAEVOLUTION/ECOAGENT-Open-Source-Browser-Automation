import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {buildClient} from './client.mjs';
import {createServer} from './tools.mjs';
const client=buildClient(process.env.ECOAGENT_API_URL||'http://127.0.0.1:8080',process.env.ECOAGENT_CLIENT_KEY||'');
await createServer(client).connect(new StdioServerTransport());
