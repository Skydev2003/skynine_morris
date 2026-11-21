import { Check, Copy, Hourglass, Swords, UserRound } from "lucide-react";
import { characters, colors, type Character, type PieceColor, type Room } from "@/lib/rooms";

type Seat = "host" | "guest";

function LoadoutCard({ character, color, ready, label, missing, mine, name }: {
  character: Character;
  color: PieceColor;
  ready?: boolean;
  label: string;
  name: string;
  missing?: boolean;
  mine: boolean;
}) {
  return (
    <div className={`loadout-card color-${color}${missing ? " slot-open" : ""}`}>
      <div className="loadout-role">{label}{mine && <span>คุณ</span>}</div>
      <div className={`loadout-portrait portrait-${character}`} aria-hidden="true">{missing && <UserRound />}</div>
      <div className="loadout-name">
        <strong>{missing ? "รอเพื่อนเข้าห้อง" : name}</strong>
        {!missing && <span>{characters[character]} · <i className="color-chip" /> หมากสี{colors[color]}</span>}
      </div>
      {ready !== undefined && <div className="ready-tag" data-ready={ready && !missing}>{ready && !missing ? <><Check /> พร้อม</> : <><Hourglass /> {missing ? "ยังไม่มีผู้เล่น" : "กำลังเตรียมตัว"}</>}</div>}
    </div>
  );
}

export function RoomLobby({ room, seat, pending, copied, copy, send }: {
  room: Room;
  seat: Seat;
  pending: boolean;
  copied: boolean;
  copy: () => void;
  send: (command: Record<string, unknown>) => void;
}) {
  const ownCharacter = room[`${seat}_character`];
  const ownColor = room[`${seat}_color`];
  const ownReady = room[`${seat}_ready`];
  const takenColor = room[seat === "host" ? "guest_color" : "host_color"];
  const canStart = Boolean(room.guest_id && room.guest_ready);
  const change = (character: Character, color: PieceColor) => send({ op: "loadout", character, color });

  return (
    <section className="room-stage" aria-labelledby="room-heading">
      <div className="room-stage-title">
        <h1 id="room-heading">ล็อบบี้ก่อนแข่ง</h1>
        <button className="invite-code" type="button" onClick={copy} aria-label="คัดลอกรหัสห้อง"><span>{copied ? "คัดลอกแล้ว" : "รหัสห้อง"}</span><strong>{room.code}</strong><Copy /></button>
      </div>
      <div className="versus-roster" aria-live="polite">
        <LoadoutCard character={room.host_character} color={room.host_color} name={room.host_name} label="โฮสต์" mine={seat === "host"} />
        <span className="vs-emblem" aria-hidden="true">VS</span>
        <LoadoutCard character={room.guest_character} color={room.guest_color} name={room.guest_name} ready={room.guest_ready} label="ผู้เข้าร่วม" missing={!room.guest_id} mine={seat === "guest"} />
      </div>
      <div className="setup-deck">
        <fieldset disabled={pending}>
          <legend>ตัวละคร</legend>
          <div className="character-picker">
            {(Object.keys(characters) as Character[]).map((character) => (
              <button key={character} type="button" aria-pressed={ownCharacter === character} onClick={() => change(character, ownColor)}>
                <span className={`picker-portrait portrait-${character}`} aria-hidden="true" /> {characters[character]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={pending}>
          <legend>สีหมาก</legend>
          <div className="color-picker">
            {(Object.keys(colors) as PieceColor[]).map((color) => (
              <button type="button" key={color} className={`color-${color}`} aria-label={`สี${colors[color]}${takenColor === color ? " ถูกจอง" : ""}`}
                aria-pressed={ownColor === color} disabled={takenColor === color} title={takenColor === color ? "สีนี้ถูกจองแล้ว" : colors[color]} onClick={() => change(ownCharacter, color)}>
                {ownColor === color ? <Check /> : takenColor === color ? <span aria-hidden="true">–</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="ready-actions">
          {seat === "guest" && <button className={ownReady ? "outline" : "primary"} type="button" disabled={pending} aria-pressed={ownReady} onClick={() => send({ op: "ready", ready: !ownReady })}>
            <Check /> {ownReady ? "ยกเลิกพร้อม" : "พร้อมแล้ว"}
          </button>}
          {seat === "host" && <button className="primary start-button" type="button" disabled={pending || !canStart} onClick={() => send({ op: "start" })}><Swords /> เริ่มเกม</button>}
        </div>
      </div>
      <p className="lobby-message" role="status">{!room.guest_id ? "ส่งรหัสห้องให้เพื่อนเพื่อเข้าร่วม" : canStart ? seat === "host" ? "เพื่อนพร้อมแล้ว เริ่มเกมได้เลย" : "รอโฮสต์เริ่มเกม" : seat === "host" ? "เลือกตัวละครและสีหมากระหว่างรอเพื่อนพร้อม" : "เลือกตัวละครและสีหมาก แล้วกดพร้อม"}</p>
    </section>
  );
}
