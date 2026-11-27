# ECOAGENT v0.44.0 — approved dynamic draft controls

Exact inspected HTML button type=button only, local single-use approval bound to snapshot, tab, URL and label. Refreshes snapshot after click. External network requests are blocked during the bounded click observation window; existing GET/HEAD restrictions remain outside that window, so delayed GET side effects cannot be ruled out. No dynamic POST, authentication or external write authorization is introduced. Offline fixture regression added. Real portal compatibility remains untested. Stacked on receipt PR 21; CI pending.
