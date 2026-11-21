import { useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { characters, colors, type QuickLoadout } from "@/lib/rooms";
import { STARTER_CHARACTERS, STARTER_COLORS, type ShopState } from "@/lib/shop";
import { Dialog } from "./dialog";

export function QuickCharacterPicker({ inventory, previous, close, start }: {
  inventory?: ShopState;
  previous?: QuickLoadout;
  close: () => void;
  start: (loadout: QuickLoadout) => void;
}) {
  const availableCharacters = inventory?.ownedCharacters ?? STARTER_CHARACTERS;
  const availableColors = inventory?.ownedColors ?? STARTER_COLORS;
  const [pickedCharacter, setPickedCharacter] = useState(previous?.character);
  const [pickedColor, setPickedColor] = useState(previous?.color);
  const selectedCharacter = pickedCharacter && availableCharacters.includes(pickedCharacter)
    ? pickedCharacter : availableCharacters.includes("hikaru") ? "hikaru" : "kai";
  const selectedColor = pickedColor && availableColors.includes(pickedColor) ? pickedColor : "mint";

  return (
    <Dialog title="เลือกตัวละครและหมาก" className="feature-dialog quick-character-dialog" close={close}>
      <form onSubmit={(event) => { event.preventDefault(); start({ character: selectedCharacter, color: selectedColor }); }}>
        <fieldset className="quick-roster">
          <legend>ตัวละคร</legend>
          {availableCharacters.map((character) => (
            <label className="quick-roster-card" key={character}>
              <input type="radio" name="quick-character" value={character} checked={selectedCharacter === character}
                onChange={() => setPickedCharacter(character)} />
              <span className={`picker-portrait portrait-${character}`} aria-hidden="true" />
              <span className="quick-roster-name">{characters[character]}</span>
              <Check className="quick-roster-check" aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        <fieldset className="quick-roster quick-pieces">
          <legend>หมาก</legend>
          {availableColors.map((color) => (
            <label className={`quick-roster-card color-${color}`} key={color}>
              <input type="radio" name="quick-color" value={color} checked={selectedColor === color}
                onChange={() => setPickedColor(color)} />
              <span className="quick-piece-swatch" aria-hidden="true" />
              <span className="quick-roster-name">{colors[color]}</span>
              <Check className="quick-roster-check" aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        <p className="quick-piece-note">ถ้าเลือกหมากแบบเดียวกัน คนเข้าคิวทีหลังจะใช้สีสำรอง</p>
        <button type="submit" className="club-quick-play quick-roster-start"><Shuffle aria-hidden="true" /> เริ่มค้นหาคู่แข่ง</button>
      </form>
    </Dialog>
  );
}
