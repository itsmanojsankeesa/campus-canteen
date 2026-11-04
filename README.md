# Campus Canteen

Order food from your phone, collect it with a token. Built with **Express + EJS + Mongoose (MongoDB)**.

## Run it (5 steps)

1. Install Node.js 20.19 or newer (22 is fine) and MongoDB (or make a free cluster on MongoDB Atlas).
2. In this folder:  `npm install`
3. Copy `.env.example` to `.env` and check the values (`MONGO_URL` especially).
4. Add the menu, the stock list and the admin account (run once):  `npm run seed`
5. Start the site:  `npm start`   then open http://localhost:3000

`npm run dev` restarts the server by itself when you change a file.

## Accounts

| Who | How to get it | Sign in with |
|---|---|---|
| Student | "Create an account" on the sign-in page | roll number or email + password |
| Admin | made by `npm run seed` | `admin@college.edu` / `admin123` (change in `.env` before seeding, or edit the password later) |

## What it does

**Student:** browse the menu (search, filters, sort), favourites, cart, combo discounts, checkout with pickup place and time, a token for each order, live order status (the page asks the server every 10 seconds), order history with Reorder, edit profile.

**Admin:** overview (today's orders, revenue, busy hours, best sellers, low-stock alert), orders (search, filter, move each order Placed > Accepted > Preparing > Ready > Completed, or cancel), menu (add, edit, delete, sold-out switch, photo link), inventory (restock), sales reports (daily, weekly, monthly from real orders). New orders show up by themselves every 15 seconds.

## Folders

```
campus-canteen/
├── app.js                 starts the server, sessions, routes
├── seed.js                menu + stock + admin account (npm run seed)
├── .env.example           settings to copy to .env
├── config/
│   ├── combos.js          combo offers (shown to students and checked by the server)
│   └── constants.js       categories, departments, input rules
├── middleware/auth.js     who is signed in, student-only / admin-only guards
├── models/                MongoDB collections
│   ├── User.js  MenuItem.js  Order.js  Counter.js  Ingredient.js
├── routes/
│   ├── pages.js           /login  /student  /admin
│   ├── auth.js            /auth/register  /auth/login   (and /logout in app.js)
│   ├── menu.js            GET /api/menu
│   ├── orders.js          POST /api/orders, GET /api/orders/mine
│   ├── me.js              PUT /api/me, POST /api/me/favourites/:id
│   └── admin.js           /api/admin/...  (orders, menu, inventory, dashboard)
├── services/dashboard.js  totals, charts and reports for the admin page
├── views/                 login.ejs  student.ejs  admin.ejs
└── public/
    ├── css/               login.css  student.css  admin.css
    ├── js/                login.js   student.js   admin.js
    └── images/            food photos (see README.txt inside)
```

## Food photos

Put `.jpg` photos in `public/images/` with the names listed in `public/images/README.txt`. A missing photo shows a coloured plate, so the site works without them.

## Good to know

- Prices are always taken from the database on the server. A student cannot change a price in the browser.
- Passwords are stored hashed (bcrypt). Sessions last 7 days.
- Sessions are kept in memory, so everyone has to sign in again after the server restarts. For a real deployment, add a session store (for example `connect-mongo`), set `SESSION_SECRET` to a long random text, and serve the site over HTTPS.
- Payment is recorded as UPI or cash only. Real online payment needs a payment gateway.
- Order numbers start at CC-0414. Tokens run A-0 to A-99 and then repeat.
- Dates and "today" use the time zone of the computer running the server.
