# Operation diagnostics 0.57.0

Exact fixed error categories for common document, approval, session and authentication failures replace the generic error. Unknown errors remain operation_failed. Expired, consumed and unknown approval IDs share approval_unavailable; no tombstones or secrets exposed. All diagnostic failures require review and prohibit automatic retry. No additional privileges or automatic approval. Windows acceptance pending.
