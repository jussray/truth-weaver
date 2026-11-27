import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { MONITORED_PAGES } from "./contract";

beforeEach(()=>{vi.resetModules();vi.stubEnv("GSC_SERVICE_ACCOUNT_JSON","");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function load() {
  return (await import("./gsc.server")).readOwnerSearchConsole;
}
describe("private Google Search Console readback",()=>{
  it("reports not configured and performs zero requests when missing credentials",async()=>{
    const mock=vi.fn();vi.stubGlobal("fetch",mock);
    expect(await (await load())()).toEqual({state:"not_configured",property:"https://truthweaver.jussco.company/"});
    expect(mock).not.toHaveBeenCalled();
  });
  it("fails closed on malformed service account credentials",async()=>{
    vi.stubEnv("GSC_SERVICE_ACCOUNT_JSON",JSON.stringify({client_email:"attacker@example.com",private_key:"fake"}));
    const mock=vi.fn();vi.stubGlobal("fetch",mock);
    await expect((await load())()).rejects.toThrow("invalid");
    expect(mock).not.toHaveBeenCalled();
  });
  it("reads only published canonical URLs through the official read-only API",async()=>{
    const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048,
      publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
    vi.stubEnv("GSC_SERVICE_ACCOUNT_JSON",JSON.stringify({client_email:"synthetic@fixture.gserviceaccount.com",private_key:privateKey}));
    const fetcher=vi.fn().mockImplementation(async (url:string,options:RequestInit)=>{
      if(url.includes("oauth2.googleapis.com"))return new Response(JSON.stringify({access_token:"synthetic-token"}),{status:200});
      if(url.includes("/sitemaps"))return new Response(JSON.stringify({sitemap:[{
        path:"https://truthweaver.jussco.company/sitemap.xml",isPending:false,errors:0,warnings:0,contents:[{submitted:"7",indexed:"999"}],
      }]}),{status:200});
      expect(options).toMatchObject({method:"POST",redirect:"error",cache:"no-store"});
      const body=JSON.parse(String(options.body));
      expect(MONITORED_PAGES).toContain(body.inspectionUrl);
      return new Response(JSON.stringify({inspectionResult:{indexStatusResult:{
        verdict:"PASS",coverageState:"Submitted and indexed",lastCrawlTime:"2026-11-25T12:00:00Z",
      }}}),{status:200});
    });
    vi.stubGlobal("fetch",fetcher);
    const result=await (await load())();
    expect(result.state).toBe("connected");
    if(result.state!=="connected")return;
    expect(result.report.sitemap.submittedUrls).toBe(7);
    expect(result.report.sitewideIndexedCount).toBeNull();
    expect(result.report.pages).toHaveLength(MONITORED_PAGES.length);
    expect(result.report.pages.every(p=>p.state==="indexed")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("999");
    expect(fetcher).toHaveBeenCalledTimes(MONITORED_PAGES.length+2);
    expect(await (await load())()).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(MONITORED_PAGES.length+2);
  });
});
