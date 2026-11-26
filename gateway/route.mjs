export function allowedRoute(method,path){
 return (method==='POST'&&path==='/mcp')||(method==='GET'&&['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path));
}
