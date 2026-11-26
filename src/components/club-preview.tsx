import { createGame } from "@/lib/morris";
import { Board } from "./morris-board";

const previewGame = createGame();
for (const point of [0, 1, 2, 12, 19]) previewGame.board[point] = "mint";
for (const point of [4, 6, 10, 15, 20]) previewGame.board[point] = "rose";

export function ClubPreview() {
  return (
    <div className="club-preview" aria-hidden="true">
      <div className="club-preview-halo" />
      <div className="club-preview-table">
        <Board game={previewGame} palette={{ mint: "mint", rose: "rose" }} active={false}
          selected={null} onPoint={() => {}} impact={null} />
        <span className="club-preview-mill" />
      </div>
      <div className="club-preview-player club-preview-luna" />
      <div className="club-preview-player club-preview-rio portrait-rio" />
    </div>
  );
}
