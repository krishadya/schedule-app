// People sign in with a username. Supabase Auth needs an email address, so
// each username maps to a placeholder address on this domain. These
// addresses never receive mail.
export const LOGIN_EMAIL_DOMAIN = "schedule.local";

export function usernameToLoginEmail(username: string) {
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
