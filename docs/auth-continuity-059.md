# 0.59.0 — assisted authentication continuity

Local-only explicit next-step authentication authorization. A live unused permit is not replaced. Each new native same-origin POST is still one-shot, bounded and human initiated. Releasing control while an authentication field remains preserves human mode and does not revoke a still-needed permit. No remote credential collection, CAPTCHA bypass, cross-origin login support, automatic retries or real submission. Unit coverage of renewal policy; Windows and real-site acceptance pending.
