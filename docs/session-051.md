# Session lifetime 0.51.0

The idle timer checks whether a pending or approved local action is still valid before closing a browser. A valid approval can defer idle closure by one idle interval; it cannot renew approval, revive a closed session, or bypass the exact snapshot and digest. Closed sessions remove their approvals. No persistent browser profiles or crash recovery. Interactive acceptance pending.
