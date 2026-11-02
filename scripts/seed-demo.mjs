// Fills an EMPTY Supabase project with realistic demo data: one admin, six
// staff members, and a few weeks of shifts with responses, assignments, an
// overlapping booking, and a pending replacement request.
//
// Usage (against a separate demo project, never your real one):
//   node --env-file=.env.demo scripts/seed-demo.mjs --yes
//
// .env.demo needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Demo logins are written to .env.demo-accounts (ignored by git).

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TIME_ZONE = "America/Los_Angeles";
const LOGIN_EMAIL_DOMAIN = "schedule.local";
const DAY = 24 * 60 * 60 * 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes. Use a separate, empty demo project.");
  process.exit(1);
}

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(step, error) {
  console.error(`${step} failed: ${error.message ?? error}`);
  process.exit(1);
}

// Safety: only seed a database that has no shifts or people yet.
const [{ count: shiftCount, error: shiftCountError }, { count: profileCount, error: profileCountError }] =
  await Promise.all([
    supabase.from("shifts").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

if (shiftCountError) fail("Checking shifts", shiftCountError);
if (profileCountError) fail("Checking profiles", profileCountError);

if ((shiftCount ?? 0) > 0 || (profileCount ?? 0) > 0) {
  console.error(
    `This project already has ${shiftCount} shifts and ${profileCount} people. ` +
      "The demo seed only runs on an empty project, so it can't mix with real data.",
  );
  process.exit(1);
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const today = todayKey();
const now = Date.now();
const deadlineIn = (days) => new Date(now + days * DAY).toISOString();

// People ----------------------------------------------------------------

const password = `demo-${randomBytes(6).toString("hex")}`;
const people = [
  { username: "jordan", fullName: "Jordan Rivera", admin: true },
  { username: "maya", fullName: "Maya Chen" },
  { username: "luis", fullName: "Luis Ortega" },
  { username: "priya", fullName: "Priya Shah" },
  { username: "sam", fullName: "Sam Okafor" },
  { username: "ava", fullName: "Ava Thompson" },
  { username: "noah", fullName: "Noah Kim" },
];
const ids = {};

for (const person of people) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${person.username}@${LOGIN_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username: person.username, full_name: person.fullName },
  });
  if (error) fail(`Creating ${person.username}`, error);
  ids[person.username] = data.user.id;
}

{
  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", ids.jordan);
  if (error) fail("Promoting the admin", error);
}

// Shifts ----------------------------------------------------------------
// offset: days from today. deadline: days from now (negative = closed).

const shifts = [
  {
    key: "welcome", event: "Welcome Week Fair", offset: -5, start: "10:00", end: "16:00",
    location: "Main Quad", deadline: -9,
    roles: { Technician: 2, "Event Assistant": 2 },
    assign: { Technician: ["luis", "sam"], "Event Assistant": ["maya", "ava"] },
  },
  {
    key: "board", event: "Board Meeting AV", offset: -2, start: "17:00", end: "20:00",
    location: "Admin Building 460", deadline: -6,
    roles: { Technician: 1 }, assign: { Technician: ["luis"] },
  },
  {
    key: "table1", event: "Table Squad", offset: 1, start: "09:00", end: "15:00",
    location: "Student Center Lobby", deadline: -1,
    roles: { Technician: 2 }, assign: { Technician: ["maya", "luis"] },
    notes: "Set up tables by 8:45. Radios at the front desk.",
  },
  {
    key: "table2", event: "Table Squad", offset: 2, start: "09:00", end: "15:00",
    location: "Student Center Lobby", deadline: -1,
    roles: { Technician: 2 }, assign: { Technician: ["maya"] },
    responses: { noah: "yes", sam: "no" },
  },
  {
    key: "career", event: "Career Fair", offset: 2, start: "12:00", end: "18:00",
    location: "Annex Ballroom", deadline: -1,
    roles: { Technician: 2, "Event Assistant": 3 },
    // Maya is also on Table Squad that morning: shows the overlap warning.
    assign: { Technician: ["sam"], "Event Assistant": ["maya", "ava"] },
    responses: { priya: "maybe", noah: "yes", luis: "no" },
    maybeTimes: { priya: ["14:00", "18:00"] },
    notes: "Business casual. Check in with the career center desk.",
  },
  {
    key: "table3", event: "Table Squad", offset: 3, start: "09:00", end: "15:00",
    location: "Student Center Lobby", deadline: 1,
    roles: { Technician: 2 },
    responses: { maya: "yes", luis: "maybe", sam: "yes" },
    maybeTimes: { luis: ["11:00", "15:00"] },
  },
  {
    key: "concert", event: "Spring Concert", offset: 4, start: "18:00", end: "23:00",
    location: "Main Theatre", deadline: 2,
    roles: { Usher: 4, Technician: 1 },
    assign: { Technician: ["luis"], Usher: ["noah"] },
    responses: { maya: "yes", sam: "maybe", priya: "yes" },
    notes: "Black clothing. Doors open at 6:30 PM.",
  },
  {
    key: "grad", event: "Graduation Rehearsal", offset: 6, start: "08:00", end: "12:00",
    location: "Stadium Field", deadline: 1,
    roles: { "Event Assistant": 3 },
    assign: { "Event Assistant": ["priya", "ava", "noah"] },
    replacement: { username: "priya", reason: "I have a midterm that morning." },
  },
  {
    key: "speaker", event: "Speaker Series", offset: 9, start: "16:00", end: "19:00",
    location: "Library Event Room", deadline: 5,
    roles: { Technician: 1, "Event Assistant": 1 },
    responses: { sam: "yes", maya: "no" },
  },
  {
    key: "alumni", event: "Alumni Dinner", offset: 12, start: "17:00", end: "22:00",
    location: "Faculty Club", deadline: 8,
    roles: { Usher: 3 },
  },
];

for (const shift of shifts) {
  const { data, error } = await supabase
    .from("shifts")
    .insert({
      event_name: shift.event,
      date: addDays(today, shift.offset),
      start_time: shift.start,
      end_time: shift.end,
      location: shift.location,
      notes: shift.notes ?? null,
      response_deadline: deadlineIn(shift.deadline),
      created_by: ids.jordan,
    })
    .select("id")
    .single();
  if (error) fail(`Creating ${shift.event}`, error);
  shift.id = data.id;

  const { error: requirementError } = await supabase.from("shift_requirements").insert(
    Object.entries(shift.roles).map(([role, staffNeeded]) => ({
      shift_id: shift.id,
      role,
      staff_needed: staffNeeded,
    })),
  );
  if (requirementError) fail(`Adding roles to ${shift.event}`, requirementError);

  // Everyone assigned said yes first; other answers come from `responses`.
  const responses = { ...(shift.responses ?? {}) };
  for (const usernames of Object.values(shift.assign ?? {})) {
    for (const username of usernames) responses[username] = "yes";
  }

  const responseRows = Object.entries(responses).map(([username, response]) => ({
    shift_id: shift.id,
    user_id: ids[username],
    response,
    suggested_start_time: shift.maybeTimes?.[username]?.[0] ?? null,
    suggested_end_time: shift.maybeTimes?.[username]?.[1] ?? null,
  }));
  if (responseRows.length > 0) {
    const { error: responseError } = await supabase
      .from("availability_responses")
      .insert(responseRows);
    if (responseError) fail(`Adding answers to ${shift.event}`, responseError);
  }

  const assignmentRows = Object.entries(shift.assign ?? {}).flatMap(([role, usernames]) =>
    usernames.map((username) => ({
      shift_id: shift.id,
      user_id: ids[username],
      assigned_role: role,
      assigned_by: ids.jordan,
    })),
  );
  if (assignmentRows.length > 0) {
    const { error: assignmentError } = await supabase
      .from("assignments")
      .insert(assignmentRows);
    if (assignmentError) fail(`Assigning ${shift.event}`, assignmentError);
  }

  if (shift.replacement) {
    const { error: replacementError } = await supabase
      .from("replacement_requests")
      .insert({
        shift_id: shift.id,
        requested_by: ids[shift.replacement.username],
        reason: shift.replacement.reason,
      });
    if (replacementError) fail(`Adding a replacement request`, replacementError);
  }
}

writeFileSync(
  ".env.demo-accounts",
  [
    "# Demo logins created by scripts/seed-demo.mjs. Not committed.",
    "DEMO_ADMIN_USERNAME=jordan",
    "DEMO_STAFF_USERNAMES=maya,luis,priya,sam,ava,noah",
    `DEMO_PASSWORD=${password}`,
    "",
  ].join("\n"),
);

console.log(
  `Demo data ready: ${people.length} people and ${shifts.length} shifts.\n` +
    "Sign in as admin \"jordan\" or any staff username. The shared password is in .env.demo-accounts.",
);
