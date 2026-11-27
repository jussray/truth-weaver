import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reviewClaimWithAiGateway } from "./gateway.server";

const input = {
  claim: "The current production version matches the expected source SHA.",
  evidence: [{label:"Source receipt",detail:"A dated GitHub Actions result states the candidate SHA passed."}],
  consent:true as const,
};
const answer = {
  gaps:[{issue:"No production readback",neededProof:"Independent HTTPS receipt and deployed version ID"}],
  attackQuestions:["Could Cloudflare still serve a different deployment?"],
  nextGate:"independent-verification",gateReason:"Verify the live worker version and user journey before release.",
};

beforeEach(()=>{
  for(const name of ["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_AI_API_TOKEN","CLOUDFLARE_AI_GATEWAY_ID","CLOUDFLARE_AI_MODEL"])
    vi.stubEnv(name,"");
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
function configured() {
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  vi.stubEnv("CLOUDFLARE_AI_API_TOKEN","synthetic-token-not-real");
  vi.stubEnv("CLOUDFLARE_AI_GATEWAY_ID","truth-weaver-evidence");
  vi.stubEnv("CLOUDFLARE_AI_MODEL","@cf/meta/llama-3.1-8b-instruct");
}

describe("AI Gateway private evidence contract",()=>{
  it("fails closed without configuration and never calls a model",async()=>{
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    await expect(reviewClaimWithAiGateway(input)).rejects.toThrow("not connected");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses claims without consent before any outbound request",async()=>{
    configured();const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    await expect(reviewClaimWithAiGateway({...input,consent:false} as never)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends only opted-in bounded evidence to the authenticated no-log gateway",async()=>{
    configured();
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]}),{status:200}));
    vi.stubGlobal("fetch",fetcher);
    const result=await reviewClaimWithAiGateway(input);
    expect(result).toMatchObject({...answer,authority:"advisory_only"});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,options]=fetcher.mock.calls[0]!;
    expect(url).toContain("/ai/v1/chat/completions");
    expect(options).toMatchObject({method:"POST",redirect:"error",cache:"no-store",headers:{
      "cf-aig-gateway-id":"truth-weaver-evidence","cf-aig-collect-log":"false","cf-aig-skip-cache":"true",
    }});
    expect(JSON.parse(options.body).messages[1].content).toContain(input.claim);
  });
  it("rejects extra model authority fields instead of promoting them",async()=>{
    configured();
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...answer,approved:true})}}]}),{status:200}));
    vi.stubGlobal("fetch",fetcher);
    await expect(reviewClaimWithAiGateway(input)).rejects.toThrow("valid advisory");
  });
});
