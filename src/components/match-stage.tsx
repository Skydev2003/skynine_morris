import { Trophy } from "lucide-react";
import { count, other, placing, type Side } from "@/lib/morris";
import { emojis, type Room } from "@/lib/rooms";
import { Board, Player } from "./morris-board";

export function MatchStage({ room, side, selected, pending, reaction, error, point, react }: {
  room: Room;
  side: Side;
  selected: number | null;
  pending: boolean;
  reaction: Room["reaction"];
  error: string;
  point: (at: number) => void;
  react: (emoji: string) => void;
}) {
  const game = room.game;
  const myTurn = game.turn === side;
  const phase = placing(game) ? "วางหมาก" : count(game, game.turn) === 3 ? "บิน" : "เลื่อนหมาก";
  const title = game.winner ? game.winner === side ? "คุณชนะ!" : "คู่แข่งชนะ!" : myTurn ? "ตาของคุณ" : "ตาของคู่แข่ง";
  const hint = game.winner ? "จบการแข่งขัน" : !myTurn ? game.capture ? "คู่แข่งกำลังเลือกจับหมาก" : "รอคู่แข่งเดินหมาก"
    : game.capture ? "สร้างมิลล์แล้ว เลือกหมากคู่แข่ง 1 ตัว" : phase === "วางหมาก" ? "เลือกจุดว่างบนโต๊ะ"
    : phase === "บิน" ? "เลือกหมากแล้วบินไปจุดว่าง" : "เลือกหมากแล้วเลื่อนไปจุดว่างที่ติดกัน";

  const palette = { mint: room.host_color, rose: room.guest_color };
  const character = { mint: room.host_character, rose: room.guest_character };
  const rival = other(side);

  return (
    <section className="table-stage" aria-label="สนามเล่น">
      <div className="turn-zone" role="status" aria-live="polite" aria-atomic="true">
        <div key={title + game.capture} className={`turn-sign color-${palette[game.turn]} ${myTurn ? "my-turn" : ""}`}>
          {game.winner ? <Trophy /> : <i className="color-chip" />}
          <div><h1>{title}</h1><p>{hint}</p></div>
          {!game.winner && <span className="phase">{phase}</span>}
        </div>
      </div>
      <Player side={side} game={game} current={myTurn && !game.winner} you character={character[side]} color={palette[side]} />
      <div className="table-center">
        <Board game={game} active={myTurn && !pending && !game.winner} selected={selected} onPoint={point} palette={palette} revision={room.game_revision} />
        {reaction && <div key={room.reacted_at} className={`reaction-pop ${reaction.sender === (side === "mint" ? room.host_id : room.guest_id) ? "mine" : ""}`} role="status">
          {reaction.emoji}<small>{reaction.sender === (side === "mint" ? room.host_id : room.guest_id) ? "คุณ" : "คู่แข่ง"}</small>
        </div>}
      </div>
      <Player side={rival} game={game} current={!myTurn && !game.winner} you={false} character={character[rival]} color={palette[rival]} />
      <div className="table-controls">
        <div className="emojis" role="group" aria-label="ส่งอิโมจิ">{emojis.map((emoji, i) =>
          <button key={emoji} title={["ทักทาย", "ไฟลุก", "ประหลาดใจ", "ปรบมือ", "เท่มาก", "เกมดี"][i]} disabled={pending} onClick={() => react(emoji)}>{emoji}</button>)}</div>
        {error && <p className="table-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
