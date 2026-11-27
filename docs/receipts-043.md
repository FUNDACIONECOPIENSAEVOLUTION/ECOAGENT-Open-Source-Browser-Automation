# ECOAGENT v0.43.0 — bounded receipt retrieval

Retrieves exact visible same-origin links on the current successful static POST response. PDF/TXT only, uncompressed declared length up to 10 MiB, no redirects, no retries. Original bytes and metadata saved under local-config/receipts for real operations; demo bytes are synthetic and not persisted. No automatic confirmation. Limitations: Playwright API response buffering may occur before length checks; external server testing, authenticated/dynamic workflows and receipt export to ChatGPT remain pending. Stacked on PR 19; CI pending.
