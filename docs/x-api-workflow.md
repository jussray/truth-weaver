# Python XDK & X API v2 Workflow

Official X API v2 client integration for Truth Weaver.
- Documentation Index: [https://docs.x.com/llms.txt](https://docs.x.com/llms.txt)
- OpenAPI Spec: [https://api.x.com/2/openapi.json](https://api.x.com/2/openapi.json)
- Upstream Samples: [https://github.com/xdevplatform/samples/tree/main/python](https://github.com/xdevplatform/samples/tree/main/python)

## Features & Verification
- OAuth 2.0 App-only Bearer Token authentication via `X_BEARER_TOKEN` or `TWITTER_BEARER_TOKEN`.
- Automated pagination through timelines and search results.
- Streaming client integration for real-time verification and social listening.
- Safe fail-closed operation: unauthenticated calls never fake green states.

## Usage
Fetch the live documentation index:
```bash
python3 scripts/x_api_client.py --docs
```
