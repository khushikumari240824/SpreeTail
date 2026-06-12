# AI_CONTEXT.md

This is the central source of truth for the Splitwise Clone application. It documents the product requirements, architectural design, API endpoints, database schemas, frontend structure, and deployment strategies.

---

## 1. Product Understanding & Scope

### Product Goals
* Create and manage groups for tracking shared expenses.
* Track individual and group-wide balances.
* Support four expense split methods: **Equal**, **Unequal**, **Percentage**, and **Share**.
* Settle debts between users and record payments.
* Provide a real-time discussion thread (chat room) within each expense.
* Deliver an intuitive user interface tailored for desktop and mobile.

### Out of Scope Features
* Recurring expenses
* Multi-currency support (Default currency is USD)
* Receipt upload/scanning (OCR)
* Search functionality within groups/expenses
* Email notifications
* Advanced analytics and charts
* Data exporting (CSV/PDF)

---

## 2. Technical Stack

* **Frontend:** React (Vite build tool), React Router (routing), Axios (HTTP client).
* **Backend:** Node.js with Express.js, Socket.IO (WebSockets for real-time chat).
* **Database:** PostgreSQL (Relational Database).
* **Styling:** Tailwind CSS, mobile-first design system.
* **Authentication:** Email & Password with JWT, stored in secure HTTP-only cookies.

---

## 3. Database Schema

All monetary values are stored as **integers in cents** (e.g., $10.00 is stored as `1000`) to prevent floating-point rounding errors.

### Users Table (`users`)
* `id`: SERIAL PRIMARY KEY
* `name`: VARCHAR(255) NOT NULL
* `email`: VARCHAR(255) UNIQUE NOT NULL
* `password_hash`: VARCHAR(255) NOT NULL
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Groups Table (`groups`)
* `id`: SERIAL PRIMARY KEY
* `name`: VARCHAR(255) NOT NULL
* `created_by`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Group Memberships Table (`group_memberships`)
* `id`: SERIAL PRIMARY KEY
* `group_id`: INTEGER REFERENCES groups(id) ON DELETE CASCADE
* `user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `role`: VARCHAR(50) DEFAULT 'member' -- 'admin' or 'member'
* `joined_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
* *Constraint:* UNIQUE(group_id, user_id)

### Group Invitations Table (`group_invitations`)
* `id`: SERIAL PRIMARY KEY
* `group_id`: INTEGER REFERENCES groups(id) ON DELETE CASCADE
* `invited_user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `invited_by`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `status`: VARCHAR(50) DEFAULT 'pending' -- 'pending', 'accepted', 'rejected'
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Expenses Table (`expenses`)
* `id`: SERIAL PRIMARY KEY
* `group_id`: INTEGER REFERENCES groups(id) ON DELETE CASCADE NULLABLE -- NULL for personal splits
* `description`: VARCHAR(255) NOT NULL
* `amount`: INTEGER NOT NULL -- Stored in cents
* `paid_by`: INTEGER REFERENCES users(id) ON DELETE RESTRICT
* `split_type`: VARCHAR(50) NOT NULL -- 'equal', 'unequal', 'percentage', 'share'
* `category`: VARCHAR(50) NOT NULL -- 'food', 'travel', 'rent', 'utilities', 'entertainment', 'other'
* `expense_date`: DATE NOT NULL
* `notes`: TEXT
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Expense Splits Table (`expense_splits`)
* `id`: SERIAL PRIMARY KEY
* `expense_id`: INTEGER REFERENCES expenses(id) ON DELETE CASCADE
* `user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `amount_owed`: INTEGER NOT NULL -- Stored in cents
* *Constraint:* UNIQUE(expense_id, user_id)

### Settlements Table (`settlements`)
* `id`: SERIAL PRIMARY KEY
* `payer_id`: INTEGER REFERENCES users(id) ON DELETE RESTRICT
* `receiver_id`: INTEGER REFERENCES users(id) ON DELETE RESTRICT
* `amount`: INTEGER NOT NULL -- Stored in cents
* `settlement_date`: DATE NOT NULL
* `notes`: TEXT
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Chat Messages Table (`chat_messages`)
* `id`: SERIAL PRIMARY KEY
* `expense_id`: INTEGER REFERENCES expenses(id) ON DELETE CASCADE
* `user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
* `message`: TEXT NOT NULL
* `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 4. API Design

### Authentication
* `POST /api/auth/register` - Registers a new user.
* `POST /api/auth/login` - Logs in user and sets secure cookie.
* `POST /api/auth/logout` - Clears cookie.
* `GET /api/auth/me` - Validates cookie and returns current user data.

### Groups
* `POST /api/groups` - Create a group.
* `GET /api/groups` - List user's groups.
* `GET /api/groups/:id` - Fetch single group details (including member profiles).
* `PUT /api/groups/:id` - Update group name.
* `DELETE /api/groups/:id` - Delete a group (only by admin, if balances settled).

### Invitations
* `POST /api/groups/:id/invite` - Send group invite via email.
* `POST /api/invitations/:id/accept` - Accept pending invitation.
* `POST /api/invitations/:id/reject` - Reject pending invitation.
* `GET /api/invitations/pending` - List user's pending invitations.

### Expenses
* `POST /api/expenses` - Create expense (performs transaction insertion on `expenses` and `expense_splits`).
* `GET /api/expenses/:id` - Get expense details and associated splits.
* `PUT /api/expenses/:id` - Edit expense.
* `DELETE /api/expenses/:id` - Delete expense.

### Settlements
* `POST /api/settlements` - Record a debt settlement.
* `GET /api/settlements` - Fetch settlement history.

### Balances
* `GET /api/groups/:id/balances` - Calculate group-wise balance sheet.
* `GET /api/users/me/balances` - Fetch individual user balance summary (how much user owes/is owed overall).

### Chat
* `GET /api/expenses/:id/messages` - Retrieve chat message history.

---

## 5. Frontend Structure & Routing

### Frontend Routes (React Router)
* `/login` - Auth Login screen
* `/register` - Auth Register screen
* `/dashboard` - Overview (Total net balance, user's current groups, pending invites, quick settlement link)
* `/groups` - List of user's groups
* `/groups/:id` - Group Details dashboard (expense activity, member lists, option to add/remove users, group balances sheet)
* `/expenses/:id` - Expense detail screen (shows expense info, split breakdown, and the real-time Chat room)
* `/settlements` - User's payment settlement log
* `/profile` - User profile details

---

## 6. Implementation Decisions & Business Logic

### Rounding Strategy
When splitting an amount creates a fractional remainder (e.g. splitting 1000 cents among 3 people: $3.3333...):
* Calculate standard splits: `1000 / 3 = 333` cents per user.
* Calculate remainder: `1000 - (333 * 3) = 1` cent.
* Add the remainder to the **first participant** list item.
  * User 1: 334 cents ($3.34)
  * User 2: 333 cents ($3.33)
  * User 3: 333 cents ($3.33)
* This ensures that total splits match the transaction amount exactly.

### Debt Engine (Bilateral)
* Simplification is not supported. Balances are calculated directly.
* Net balance between User A and User B:
  * Sum of all expenses paid by A where B was a participant (B owes A)
  * Minus sum of all expenses paid by B where A was a participant (A owes B)
  * Plus settlements paid by B to A
  * Minus settlements paid by A to B

### Real-Time Socket Connection
* Socket connection initialized upon mounting the Expense Details page.
* Join room: `socket.emit('joinRoom', { expenseId })`.
* Receive/send message: `socket.on('message', callback)` / `socket.emit('chatMessage', data)`.

---

## 7. Deployment Plan
* **Frontend:** Deployed to **Vercel** with routing configured for Single Page App.
* **Backend:** Deployed to **Render** Web Services.
* **Database:** Hosted PostgreSQL database on Render.
* **WebSockets Integration:** Enable HTTP/WebSocket connection sharing in Express backend.

---

## 8. Testing & Validation
* **Backend Unit Testing:** Testing of the four split calculation modules (equal, unequal, percentage, share) verifying cents-based remainder distribution.
* **Integration Testing:** Auth middleware check, API contract validation.

---

## 9. Known Trade-Offs & Limitations
* No multi-currency support.
* Direct bilateral calculations only (lack of graph-based debt simplification).
* High concurrency issues on fast edit/delete of splits will rely on database lock transactions.

---

## 10. AI Collaboration Record (Prompts Used)
1. **Initial workflow proposal:** Outline of phases and documentation approach.
2. **Requirements clarification prompt:** Alignment on DB choices, monetary values storage, split methods, chat transport, and MVP scope.
