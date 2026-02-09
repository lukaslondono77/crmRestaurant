# Fila HTML Files — Categorization and Cleanup Plan

Analysis of the **201 HTML files** in `fila/` for Cloudignite: categorize into Core Restaurant App, Demo/Example, Utility/Admin, and Redundant/Unused, with a concrete plan to keep core, archive demos, and remove unused.

---

## 1. Categories

### 1.1 Core Restaurant App (~30 files)

Pages that are part of the main Cloudignite product: dashboard, inventory, invoices, analytics, orders, products, connections, auth, and key settings.

| File | Purpose |
|------|---------|
| index.html | App entry / dashboard landing |
| analytics.html | Analytics view |
| inventory-count.html | Inventory counting |
| manual-data-entry.html | Manual data entry |
| reports.html | Reports |
| invoices.html | Invoices list |
| invoice-details.html | Invoice detail |
| connections.html | API/connection setup |
| diagnose-connection.html | Connection diagnostic |
| categories.html | Product categories |
| products-list.html | Products list |
| products-grid.html | Products grid |
| product-details.html | Product detail |
| create-product.html | Create product |
| edit-product.html | Edit product |
| create-category.html | Create category |
| edit-category.html | Edit category |
| orders.html | Orders |
| order-details.html | Order detail |
| order-tracking.html | Order tracking |
| create-order.html | Create order |
| cart.html | Cart |
| checkout.html | Checkout |
| wallet-balance.html | Wallet/balance |
| data-entry-backup.html | Data entry backup |
| validacion-checklist.html | Validation checklist |
| reporte-pruebas.html | Test report |
| settings.html | App settings |
| account-settings.html | Account settings |
| sign-in.html | Login |
| sign-up.html | Register |
| logout.html | Logout |
| change-password.html | Change password |
| forgot-password.html | Forgot password |
| reset-password.html | Reset password |
| confirm-email.html | Confirm email |
| lock-screen.html | Lock screen |
| alerts.html | Alerts |
| notifications.html | Notifications |
| my-profile.html | My profile |
| user-profile.html | User profile |
| users.html | Users |
| users-list.html | Users list |
| add-user.html | Add user |
| create-user.html | Create user |
| blank-page.html | Blank / placeholder |
| starter.html | Starter page |

**Count:** ~40 (some overlap with utility; adjust if any are template-only).

---

### 1.2 Demo / Example Pages (~120+ files)

Template demos for other verticals (CRM, LMS, Hospital, School, HR, Projects, Email, etc.). Not required for the restaurant product; good candidates to move to `/templates/` or archive.

- **CRM:** crm.html, contacts-crm.html, customers-crm.html, customer-details.html, create-contact.html, create-lead.html, create-deal.html, leads.html, deals.html, contacts.html, clients.html
- **LMS / School:** lms.html, school.html, courses-list.html, all-courses.html, course-details.html, add-course.html, edit-course.html, create-course.html, add-student.html, student-list.html, add-teacher.html, teacher-list.html, instructors.html, fees-collection.html, add-fees.html, library.html, add-library-book.html, school-attendance.html
- **Hospital:** hospital.html, doctors.html, doctor-details.html, patients.html, patient-details.html, book-appointments.html
- **HR:** hr-management.html, employee-list.html, add-new-employee.html, add-staff.html, staff-list.html, add-departments.html, departments.html, employee-leave.html, add-leave.html, employee-salary.html, create-payslip.html, holidays.html, all-schedule.html
- **Projects:** project-management.html, project-overview.html, projects-list.html, projects.html, create-project.html, kanban-board.html, kanban-board-project.html
- **Events:** events.html, event-details.html, create-an-event.html, edit-an-event.html
- **Help desk:** help-desk.html, ticket-details.html, tickets.html
- **Marketing / Reviews:** marketing.html, testimonials.html, reviews.html
- **Finance / Refunds:** finance.html, refunds.html
- **Sellers / Members:** sellers.html, seller-details.html, create-seller.html, members.html, teams.html, teams2.html, team-members.html
- **Email:** inbox.html, compose.html, read-email.html, all-mail.html, sent.html, starred.html, snoozed.html, drafts.html, spam.html, trash.html, important.html
- **Calendar:** calendar.html
- **Files / Media:** file-uploader.html, my-drive.html, documents.html, gallery.html, images.html, videos.html, media.html, recents.html, important-file.html, spam-file.html, trash-file.html
- **Misc demo:** applications.html, company.html, more.html, friends.html, personal.html, personals.html, list.html, projects-file.html, search.html, faq.html, pricing.html, terms-conditions.html, privacy-policy.html, coming-soon.html, 404-error-page.html, internal-error.html
- **UI kits / charts:** widgets.html, to-do-list.html, chat.html, area.html, line.html, column.html, pie.html, radial-bar.html, polar.html, mixed.html, radar.html, basic-elements.html, advanced-elements.html, accordions.html, buttons.html, cards.html, carousels.html, dropdowns.html, modals.html, navs.html, paginations.html, progress.html, spinners.html, tabs.html, avatar.html, grids.html, date-time-picker.html, validation.html, wizard.html, editors.html, basic-table.html, data-table.html, maps.html, remix-icon.html, material-symbols.html

---

### 1.3 Utility / Admin Pages (~15 files)

Shared utilities: error pages, password flows, profile, support.

- 404-error-page.html, internal-error.html
- forgot-password.html, reset-password.html, confirm-email.html
- my-profile.html, user-profile.html, account-settings.html
- alerts.html, notifications.html
- blank-page.html, starter.html
- settings.html
- (Overlap with Core where they are part of the main app.)

---

### 1.4 Redundant / Unused (~20–30 files)

Candidates for removal after verification (no links from core app, duplicate or obsolete).

- Duplicate or alternate UI demos (e.g. teams2.html vs teams.html, personals.html vs personal.html).
- Template-only pages with no Cloudignite-specific logic and no navigation from core (e.g. some of the chart/component demos if not used in analytics or reports).
- Old test/validation pages that are superseded (e.g. reporte-pruebas.html, validacion-checklist.html can stay in Core if still used; otherwise move to archive).

A full “redundant” list should be derived by: (1) listing all links from Core and Utility pages, (2) marking any HTML never linked and not referenced in router/config, (3) confirming with team before delete.

---

## 2. Proposed Plan

### a) Keep (Core + Utility)

- Keep all **Core Restaurant App** and **Utility/Admin** pages in `fila/` at current paths.
- Ensure navigation and `API_BASE_URL` point only to these where relevant.

### b) Archive demo pages

- Create **`fila/templates/`** (or **`templates/demo/`** at repo root).
- Move all **Demo/Example** HTML (and their assets if self-contained) into `templates/`.
- Update any “template gallery” or docs to point to `templates/` so demos remain available but out of the main app tree.
- Option: serve `templates/` only in dev or via a separate path (e.g. `/templates/`) so production build can exclude them.

### c) Remove unused

- After link/config analysis, **delete** only files confirmed:
  - Not linked from Core or Utility, and
  - Not referenced in docs or scripts, and
  - Not needed for template gallery.
- Prefer moving questionable files to `templates/` or `archive/` instead of deleting until product owner approves.

---

## 3. Effort Note

The **“201 HTML pages with duplicated layout/scripts”** finding is **low risk** but **large effort**: many files share layout and scripts, so changes (e.g. moving to templates) should be done in batches with regression checks (links, routing, assets). Recommended order:

1. **Document** all links from Core pages (manual or script).
2. **Create** `fila/templates/` and move one demo vertical (e.g. CRM or LMS) as a pilot; fix links and assets.
3. **Move** remaining demo verticals in batches.
4. **Identify** redundant list from step 1 + link scan; move or delete with approval.
5. **Optionally** introduce a single layout/script include to reduce duplication (separate refactor).

---

## 4. Summary Table

| Category            | Est. count | Action              |
|---------------------|------------|---------------------|
| Core Restaurant App | ~30–40     | Keep in `fila/`     |
| Demo/Example        | ~120+      | Archive to `templates/` |
| Utility/Admin       | ~15        | Keep in `fila/`     |
| Redundant/Unused    | ~20–30     | Delete after verify |

Total: 201 files. After cleanup: Core + Utility remain in main app; demos in `templates/`; redundant removed after verification.

---

## 5. Execution status

- **Done:** `fila/templates/` created; **152** demo/example HTML files moved from `fila/` to `fila/templates/`. Asset paths in moved files updated to `../assets/`; links to main app (index, sign-in, analytics, settings, etc.) updated to `../…`. Script: `fila/scripts/move-demos-to-templates.sh`.
- **Optional next:** Link scan from Core/Utility to confirm no broken references; then identify and remove or archive redundant/unused files with approval.
