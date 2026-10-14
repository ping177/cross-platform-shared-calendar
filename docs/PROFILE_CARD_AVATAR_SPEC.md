# Profile Card Compact + Avatar v1

Status: CLOSED / PASS — user-confirmed Production manual acceptance. No new formal version.
Space Rename has passed user-reported Production functional and final UI acceptance.

## Objective and scope

Keep the My profile card compact: 48px circular avatar, current name and a 16px Pencil with a 44×44 touch target. Only editing shows the name input and Save/Cancel; preserve trim, 1–20 characters, unchanged no-op, synchronous submission lock, IME protection and retry with the draft intact. Long names must fit at 375px.

Clicking the avatar opens one lightweight mobile Sheet: upload a photo, choose one of 12 original SVG illustrations (six animals / six nature motifs), or restore default. Use the existing UI v2 tokens, React/TypeScript, Lucide and Supabase. No new dependencies, avatar builder, unrelated UI or business changes.

## Data and security contract

- `profiles.avatar_preset` and `profiles.avatar_path` are nullable and mutually exclusive; both null means default. Presets are an allowlist, photo paths are immutable `<profile UUID>/<object UUID>.jpg`.
- Private `profile-avatars` Storage bucket; JPEG output ≤1 MiB. The device accepts JPEG/PNG/WebP ≤10 MiB, decodes it, center-crops and scales to 512px, then re-encodes JPEG to strip photo metadata. Unsupported/undecodable images fail without changing the saved avatar.
- Reuse existing self-update Profile RLS. Add only avatar bucket policies: owner uploads/deletes; owner and current same-space members read. No changes to existing Space/Profile/membership RLS or Lifecycle semantics.
- Read current metadata before writing; compare-and-set prevents a stale device from overwriting another device's change. Upload an immutable file before switching metadata; remove the previous file only after confirmed metadata success. Unconfirmed metadata errors retain the new upload for the existing >24h unreferenced-file recovery: even a fresh read might precede a late commit. Confirmed conflicts can clean the unused new upload immediately. Failed old-file cleanup is reported and can be retried without repeating the profile mutation. Never delete a currently referenced file.
- On opening the Sheet, inspect at most 100 oldest own objects for abandoned uploads. Only unreferenced canonical files older than 24 hours become cleanup candidates; a user-visible retry button handles them. This is bounded recovery, not a scheduled storage framework. Failed scans leave editing usable; repeat on the next opening. No local persistent photo/cleanup database.
- Signed URLs live five minutes and refresh before expiry, on foreground/focus and after image failure with bounded retry. They are kept only in component memory, not persistent browser storage. Previously issued URLs remain bearer URLs until their short expiry; membership revocation prevents new signing.
- Show avatars in My, the Space management member list and the existing MemberSheet. Members have no avatar edit controls.

## Structure and style

Use `src/components` for the card/avatar/Sheet, `src/lib` for small validation and transport helpers, `public/avatars` for SVGs, `tests` for Node/Vite tests, `supabase/patches` and `supabase/tests` for the additive contract. Keep the existing two-space, single-quote style, e.g. `if (error) throw error;`.

## Ordered tasks and verification

1. Compact card/name edit: card component, My integration and regression tests. Verify blank/length/trim/no-op/IME/duplicate/failure/unmount and preserved existing My actions.
2. Avatar persistence: helpers, Profile type/query, canonical schema and forward patch. Verify self-only writes, same-space reads, outsider/anon rejection, path/preset constraints, stale updates, failure safety and cleanup in an isolated local database and transport fixtures.
3. Assets and avatar UI: original 12 SVGs, shared avatar rendering/renewal and Sheet. Verify selecting/upload/reset/error/retry, keyboard/focus/Escape, member rendering and no remote calls in offline preview.
4. Integration and review: relevant/full tests, TypeScript/Build, real browser at 320/375/390/768/1024, image processing, screenshots of card/Sheet/all 12 presets. Update DEVLOG and TESTING with exact evidence and limits.

Commands: `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`, `node_modules/.bin/tsc -b`, `npm run build`, `git diff --check`. Local dev: `npm run dev`, fixed `http://127.0.0.1:5175`, strictPort. Local SQL harness uses random disposable databases in the existing local Docker container, never Production.

## Boundaries and acceptance

Always validate both UI and server boundaries, keep secrets out of output, show major diffs and provide 375px screenshots plus a complete 12-preset preview. Automated geometry checks do not establish aesthetic acceptance.

Original implementation boundaries excluded Commit/Push/deployment and governance closeout; later explicit release and docs-only closeout authorizations superseded those workflow restrictions. No new dependencies or persistent filesystem data; this closeout makes no business/avatar/backend changes.

The user has approved the compact card, Sheet and all 12 presets; cat uses F geometry + 02「陶粉与燕麦」. Local/real-account integration and the formal Production frontend are user-accepted; release and alignment have completed. Cross-device/device/PWA edge coverage remains incomplete and is retained separately. Exact SQL Editor steps: [Deployment preparation](./PROFILE_AVATAR_DEPLOYMENT.md).

## Implementation file index

- UI: `src/components/MyPage.tsx`, `ProfileCard.tsx`, `ProfileAvatar.tsx`, `AvatarPicker.tsx`, `SpaceManagementPage.tsx`, `MemberSheet.tsx`; scoped additions to `src/styles.css`.
- Data: `src/lib/profile.ts`, `avatar.ts`, `avatar-data.ts`, `space-members.ts`; `src/types.ts`.
- Assets: `public/avatars/{cat,rabbit,bear,fox,dog,bird,flower,leaf,moon,star,cloud,sun}.svg` (12 original resources; cat F + 02).
- Backend: `supabase/schema.sql`, `supabase/patches/2026-10-14-profile-avatar.sql`, `supabase/tests/2026-10-14-profile-avatar.test.sql`, `supabase/tests/profile_avatar_local.py`.
- Tests: `tests/avatar.test.ts`, `avatar-ui.test.ts`, `profile-card-ui.test.ts`, updated `me-spaces-ui-v2.test.ts`.
- Documentation: this spec, `docs/DEVLOG.md`, `docs/TESTING.md`. `PROJECT_STATE.md` is updated under the subsequent explicit docs-only closeout authorization.

## Confirmed acceptance / release boundary

用户真实账号本地集成验收已通过：名称保存/取消；预设保存/刷新持久化；照片上传显示；同Space成员读取照片；切回预设后旧照片从Storage删除。12头像视觉已确认、猫F+02。用户随后明确确认Production新前端最终人工验收PASS，功能CLOSED / PASS。未完整覆盖的跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space后新签拒绝、5分钟续期与iOS/Android/PWA仍待记录；自动测试不替代人工证据。数据整理独立延期、不阻塞本次发布。

## Final governance closeout — 2026-10-14

用户确认Profile Card Compact + Avatar v1正式Production人工验收PASS，最终状态CLOSED / PASS；Space Rename真实Production功能及最终UI也为CLOSED / PASS。Avatar已验收功能发布Source SHA：fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。12预设及猫F+02「陶粉与燕麦」保持冻结。该整体验收不扩大为跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space的新签拒绝、5分钟签名续期及iOS/Android/PWA全部边界已通过；未完整验证项继续在观察期记录。

暂停常规功能开发，进入约两周真实使用观察（2026-10-14起，约至2026-10-28）；记录实际使用问题与未完整覆盖的边界，再决定是否需要后续修正。未来独立待办：整理测试数据，三个测试账号保留两个；保留账号选择与清理需另行确认，本轮不执行，也不是当前阻塞项。不创建新版本或启动新功能。

Prior preparation/test checkpoints above are historical; their pending wording does not reopen the completed release. Existing957/957,49/49,TypeScript/Build and222 local SQL evidence retained; docs-only closeout runs diff-check only.
