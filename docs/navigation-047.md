# Navigation 0.47.0

Read-only HTTP redirects permit up to four hops within the exact approved HTTPS origin, without query, fragment or credentials. POST and authentication rules are unchanged. Upstream navigation failures return a synthetic HTTP 502 diagnostic; rejected redirects return 403, excessive redirects 508. These are connector diagnostics, not necessarily upstream status codes. No cross-origin CDN, SSO or access-denial bypass is added. External portal acceptance remains pending.
