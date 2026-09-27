import "server-only";
import { sql } from "@/lib/db";

export type ConnectedPicLink={
  id:number;
  sourceFlightId:number;
  sourceUserId:number;
  connectedUserId:number;
  displayName:string;
  connectionAccepted:boolean;
};

type ConnectedPicRow={
  id:number|string;
  source_flight_id:number|string;
  source_user_id:number|string;
  connected_user_id:number|string;
  display_name:string;
  connection_accepted:boolean;
};

export async function getConnectedPicLink(sourceUserId:number,sourceFlightId:number):Promise<ConnectedPicLink|null>{
  if(!Number.isSafeInteger(sourceUserId)||sourceUserId<=0||!Number.isSafeInteger(sourceFlightId)||sourceFlightId<=0)return null;
  const rows=await sql`SELECT c.id,c.source_flight_id,c.source_user_id,c.connected_user_id,u.display_name,
    EXISTS(
      SELECT 1 FROM pilot_connections pc
      WHERE pc.status='accepted'
        AND ((pc.requester_user_id=c.source_user_id AND pc.recipient_user_id=c.connected_user_id)
          OR (pc.recipient_user_id=c.source_user_id AND pc.requester_user_id=c.connected_user_id))
    ) connection_accepted
    FROM flight_connected_crew c
    JOIN users u ON u.id=c.connected_user_id
    WHERE c.source_flight_id=${sourceFlightId} AND c.source_user_id=${sourceUserId} AND c.intended_role='PIC'
    LIMIT 1` as ConnectedPicRow[];
  const row=rows[0];
  if(!row)return null;
  return{
    id:Number(row.id),
    sourceFlightId:Number(row.source_flight_id),
    sourceUserId:Number(row.source_user_id),
    connectedUserId:Number(row.connected_user_id),
    displayName:String(row.display_name??"").trim(),
    connectionAccepted:Boolean(row.connection_accepted),
  };
}

export function upsertConnectedPicLinkQuery(sourceUserId:number,sourceFlightId:number,connectedUserId:number){
  return sql`INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at)
    SELECT f.id,f.user_id,${connectedUserId},'PIC',NOW()
    FROM flights f
    WHERE f.id=${sourceFlightId}
      AND f.user_id=${sourceUserId}
      AND f.certified_at IS NULL
      AND f.locked_at IS NULL
      AND UPPER(TRIM(COALESCE(f.role,'')))='SAFETY PILOT'
      AND ${connectedUserId}<>${sourceUserId}
      AND EXISTS(
        SELECT 1 FROM pilot_connections pc
        WHERE pc.status='accepted'
          AND ((pc.requester_user_id=${sourceUserId} AND pc.recipient_user_id=${connectedUserId})
            OR (pc.recipient_user_id=${sourceUserId} AND pc.requester_user_id=${connectedUserId}))
      )
    ON CONFLICT(source_flight_id,intended_role) DO UPDATE
      SET source_user_id=EXCLUDED.source_user_id,connected_user_id=EXCLUDED.connected_user_id,updated_at=NOW()
    RETURNING id,source_flight_id,source_user_id,connected_user_id,intended_role`;
}

export function deleteConnectedPicLinkQuery(sourceUserId:number,sourceFlightId:number){
  return sql`DELETE FROM flight_connected_crew
    WHERE source_flight_id=${sourceFlightId} AND source_user_id=${sourceUserId} AND intended_role='PIC'
    RETURNING id`;
}
