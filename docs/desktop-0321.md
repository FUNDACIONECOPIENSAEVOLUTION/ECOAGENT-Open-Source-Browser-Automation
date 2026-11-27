# ECOAGENT v0.32.1 — public discovery handoff

Observed HTTP 403 on GlobalGiving and UNGM in a real local read test. The discovery batch now skips further requests to an origin after denial, drops denied content, and returns explicit human-review destinations. Rate-limit and connection failures stop the batch. Complete means every URL was accounted for, not that all pages were accessible; allAccessible reports actual success. No authentication, anti-bot bypass, external write or automatic retry added. CI and Windows acceptance remain separate gates.
