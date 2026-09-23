# Shared Life Architecture Freeze

Status: `ARCHITECTURE FROZEN / FUTURE IMPLEMENTATION STAGED`

This document freezes the long-term product model and navigation direction. It does not change the accepted v0.1.8 Production capability or the v0.1.9 Slice 1 database contract. The version roadmap below is directional; each implementation version still needs its own scope and approval.

## Primary Navigation

The long-term first-level navigation is `首页 / 日历 / 空间 / 我的`.

| Destination | Responsibility |
| --- | --- |
| 首页 | Cross-module summary and future global create `+` |
| 日历 | Time views and aggregation of Calendar Sources |
| 空间 | Personal and Shared Spaces with their content modules |
| 我的 | Profile, account, notifications, devices, and settings |

v0.1.9 does not implement the complete four-destination navigation.

## Spaces and Canonical Ownership

- Each user will own one Personal Space for genuinely private content.
- A user may belong to multiple Shared Spaces, including couple, family, friends, or travel groups.
- Every business object has exactly one canonical Space. A view may aggregate objects from multiple Spaces, but an object is not canonically owned by multiple Spaces at once.
- A `personal` Event inside a Shared Space is still visible to that Space's members under the existing Event model. It describes member ownership within that Shared Space; it is not content in the user's private Personal Space.
- The current one-Space product lifecycle and `MULTISPACE_NOT_REQUIRED_FOR_V019` remain unchanged in v0.1.9. The explicit `tasks.space_id` implemented in Slice 1 is compatible with this future model.

## Space Capabilities and Module Enablement

`Space = Calendar Core + Optional Modules`.

Calendar is the core capability of every Space. Optional modules may include Tasks, Lists, Important Dates, Review / Check-in, Memo, and later validated modules.

- Enablement belongs to the Space, not to an individual member's preference. Different Spaces may enable different modules.
- A disabled module does not appear in that Space's main interface.
- Disabling a module preserves its historical data; re-enabling makes that data visible again.
- Permanent deletion of module data is deferred.
- Who may enable or disable modules is deliberately left to the v0.1.10 implementation design freeze.

Module enablement is a future capability. v0.1.9 does not add enablement storage, controls, or permissions.

## Calendar Sources

The long-term Calendar view aggregates sources, not just one Space's Events.

| Source class | Examples |
| --- | --- |
| Space-backed | Personal Space Calendar; Shared Space Calendars |
| Global or external | 中国节假日 / 调休; ICS; future Google Calendar; future Apple/System Calendar or native integration |

Global and external Calendar Sources do not require a corresponding Space and may serve all Spaces. A user can overlay multiple Space Calendars or filter down to one Space. External integrations are future work, not an implicit data migration into Space ownership.

## Global Create and Privacy Guardrail

The future global `+` may create 日程, 待办, 清单, 重要日期, or 备忘. Wishlist is a List type, not a first-level content type.

The target Space default follows the user's current context:

1. Inside a specific Space: that Space.
2. In Calendar with exactly one Space selected: that Space.
3. On Home, in All Spaces, or without clear Space context: Personal Space.

The creation form must visibly show the target Space and allow changing it. Its primary action reads `保存到「Space Name」`. After that action, a second confirmation explicitly names the target Space; the write occurs only after confirmation. A lightweight success confirmation may follow. These steps guard against accidentally sharing private content into the wrong Space.

Global create is deferred beyond v0.1.9. The target rule does not create or assume a Personal Space in the current implementation.

## Content Semantics

- Event: when something happens.
- Task: something that remains to be completed. A future read-only Calendar projection may show `tasks.due_on`; it does not create an Event or duplicate Task persistence.
- v0.1.9 Slice 2 will present Completed Tasks in a separate history section with reopen and delete actions. Task Archive is deferred; there is no `archive` status in the v0.1.9 data contract.
- Review / Check-in is structured Space content distinct from Memo. Its future structure includes review period, Focus, Achievements / Wins, Problems, next-period plan, historical continuity, and access to the previous plan when preparing the next Review.
- Voice input is an important future Review experience goal. The recording and transcription technology is not frozen here.

## Directional Roadmap

| Version | Direction |
| --- | --- |
| v0.1.9 | Shared Tasks |
| v0.1.10 | Personal Space + Multi-space + Module Enablement Foundation |
| v0.1.11 | Navigation + Aggregation Experience |
| v0.1.12 | Shared Lists |
| v0.1.13 | Important Dates |
| v0.1.14 | Structured Review / Check-in |
| v0.1.15 | Calendar Sources v1 |

Future directions without a committed version: Memo, Photos / Memories, richer external Calendars, Task Archive, and other validated modules. Native has a decision gate only; no native implementation version is committed.

## v0.1.9 Slice Boundary

Slice 1 remains `IMPLEMENTED / LOCAL VERIFICATION PASS`. Slice 2 remains `NOT STARTED` and awaits review of its amended UI scope and explicit implementation approval.

Slice 2 puts Tasks under the existing current Space context through the minimum reusable current-Space / Space Hub experience needed to reach them. It does not implement Personal Space, Multi-space, module enablement, the complete four-destination navigation, Calendar aggregation, or global create. Slice 3 Production acceptance remains separately authorized.
