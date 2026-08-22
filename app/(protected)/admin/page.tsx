import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { changeRole,createUser,resetUserPassword,toggleUser } from "./actions";
export const metadata={title:"Administration | FlyTally"};
const t=(v:unknown)=>String(v??"");

export default async function AdminPage(){
  const session=await requireUser();if(session.role!=="admin")redirect("/dashboard");
  const users=await sql`SELECT u.id,u.email,u.display_name,u.role,u.active,u.created_at,c.last_login_at,(SELECT COUNT(*) FROM flights f WHERE f.user_id=u.id)::int flights,(SELECT COUNT(*) FROM flight_tracks ft WHERE ft.user_id=u.id)::int tracks FROM users u LEFT JOIN user_credentials c ON c.user_id=u.id ORDER BY u.active DESC,u.email` as Array<Record<string,unknown>>;
  return <>
    <header className="page-header"><div><p className="eyebrow">APPLICATION</p><h1>Administration</h1></div></header>
    <details className="panel" open><summary>Add user</summary><form action={createUser} className="inline-editor"><input name="display_name" placeholder="Name" required/><input name="email" type="email" placeholder="Email" required/><input name="password" type="password" minLength={10} placeholder="Initial password" required/><select name="role" defaultValue="user"><option value="user">user</option><option value="admin">admin</option></select><button className="primary-button">Create account</button></form></details>
    <section className="panel"><div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Flights / GPS</th><th>Last sign-in</th><th>Password</th><th>Status</th></tr></thead><tbody>{users.map(u=><tr key={t(u.id)}><td><strong>{t(u.display_name)||t(u.email)}</strong><small>{t(u.email)}</small></td><td>{Number(u.id)===session.userId?<span>{t(u.role)}</span>:<form action={changeRole} className="inline-action"><input type="hidden" name="id" value={t(u.id)}/><select name="role" defaultValue={t(u.role)}><option value="user">user</option><option value="admin">admin</option></select><button>Save</button></form>}</td><td>{t(u.flights)} / {t(u.tracks)}</td><td>{u.last_login_at?new Date(t(u.last_login_at)).toLocaleString("en-GB"):"—"}</td><td>{Number(u.id)===session.userId?<span className="muted">Profile</span>:<form action={resetUserPassword} className="inline-action"><input type="hidden" name="id" value={t(u.id)}/><input name="password" type="password" minLength={10} placeholder="New password" required/><button>Set</button></form>}</td><td>{Number(u.id)===session.userId?<span className="status-on">Current account</span>:<form action={toggleUser}><input type="hidden" name="id" value={t(u.id)}/><button className={Number(u.active)?"status-on":"status-off"}>{Number(u.active)?"Active":"Inactive"}</button></form>}</td></tr>)}</tbody></table></div></section>
  </>;
}
