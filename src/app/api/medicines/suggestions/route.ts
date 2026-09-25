export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
 if(q.length<2 || q.length>200) return Response.json({data:[]},{status:400});
 const base=process.env.API_BASE_URL;
 if(!base) return Response.json({data:[]},{status:503});
 try {
   const url=new URL(`${base.replace(/\/$/, "").replace(/\/api\/v1$/, "")}/api/v1/medicines/suggestions`);
   url.searchParams.set("q",q);
   const result=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
   if(!result.ok) return Response.json({data:[]},{status:result.status===429?429:503});
   return Response.json(await result.json(),{headers:{"cache-control":"no-store"}});
 } catch {return Response.json({data:[]},{status:503});}
}
