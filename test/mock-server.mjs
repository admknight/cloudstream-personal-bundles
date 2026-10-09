// Test-only HTTP adapter; not included in deployed Worker.
import {createServer} from 'node:http';
import worker from '../src/worker.js';
import {CATALOG_URL} from '../src/catalog.js';
const data = [
 {name:'Open Movie',internalName:'OpenMovie',url:'https://example.org/OpenMovie.cs3',status:1,version:4,apiVersion:1,authors:['A'],description:'Movies in Hindi',tvTypes:['Movie'],language:'hi',fileHash:'sha256-aabb'},
 {name:'Family Anime',internalName:'FamilyAnime',url:'https://example.org/FamilyAnime.cs3',status:1,version:2,apiVersion:1,authors:['B'],description:'Anime and cartoons',tvTypes:['Anime'],language:'en'},
 {name:'NSFW Test Plugin',internalName:'NSFWPlugin',url:'https://example.org/NSFWPlugin.cs3',status:1,version:3,apiVersion:1,authors:['C'],description:'Adult content upstream metadata',tvTypes:['NSFW'],language:'en'},
 {name:'Down Plugin',internalName:'DownPlugin',url:'https://example.org/DownPlugin.cs3',status:0,version:1,apiVersion:1,authors:['D'],description:'Unreachable',tvTypes:['Movie'],language:'ar'},
 {name:'Slow Series',internalName:'SlowSeries',url:'https://example.org/SlowSeries.cs3',status:2,version:8,apiVersion:1,authors:['E'],description:'Slow plugin',tvTypes:['TvSeries'],language:'de'},
 {name:'<img src=x onerror=window.evil=true>',internalName:'Escaped',url:'https://example.org/Escaped.cs3',status:1,version:1,apiVersion:1,authors:['F'],description:'<svg onload=window.evil=true>',tvTypes:['Movie'],language:'en'}
];
for(let i=0;i<48;i++)data.push({name:'Provider '+String(i+1).padStart(2,'0'),internalName:'Provider'+i,url:'https://example.org/p'+i+'.cs3',status:1,version:1,apiVersion:1,authors:['Test'],description:'An example provider',tvTypes:['Movie'],language:'en'});
globalThis.fetch=async (url)=>{
 if(url===CATALOG_URL)return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 throw Error('Unexpected external fetch '+url);
};
const server=createServer(async (req,res)=>{
 try{
  const host=req.headers.host||'127.0.0.1:8787';
  const response=await worker.fetch(new Request('http://'+host+req.url,{method:req.method}));
  res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(err){res.writeHead(500);res.end(String(err));}
});
server.listen(8787,'127.0.0.1',()=>console.log('Mock server ready 8787'));
