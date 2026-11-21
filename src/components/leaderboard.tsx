import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { browserDb } from "@/lib/browser-db";
import { GameLottie } from "./game-lottie";

type Standing = { rank: number; display_name: string; wins: number; is_you: boolean };

export function Leaderboard() {
  const [standings, setStandings] = useState<Standing[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void browserDb()?.rpc("morris_leaderboard").then(({ data, error }) => {
      if (cancelled) return;
      if (error || !Array.isArray(data)) setFailed(true);
      else setStandings(data as Standing[]);
    });
    return () => { cancelled = true; };
  }, []);

  if (failed) return <p role="alert">โหลดอันดับไม่สำเร็จ เปิดตารางอีกครั้งเพื่อลองใหม่</p>;
  if (!standings) return <div className="rank-loading" role="status"><GameLottie kind="loading" /> กำลังโหลดอันดับ</div>;
  if (!standings.length) return <p>ยังไม่มีผลการแข่งขัน ผู้ชนะคนแรกจะปรากฏที่นี่</p>;
  return (
    <>
      <p className="rank-explainer">เรียงตามจำนวนชัยชนะจากการแข่งขันระหว่างผู้เล่น</p>
      <table className="rank-table">
        <thead><tr><th scope="col">อันดับ</th><th scope="col">ผู้เล่น</th><th scope="col">ชนะ</th></tr></thead>
        <tbody>{standings.map((entry, i) => (
          <tr key={i} data-you={entry.is_you} data-rank={entry.rank}>
            <td>{entry.rank === 1 && <Trophy aria-hidden="true" />} {entry.rank}</td>
            <th scope="row">{entry.display_name}{entry.is_you && <span className="rank-you">คุณ</span>}</th>
            <td>{entry.wins.toLocaleString("th-TH")}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}
