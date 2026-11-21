import { turnSeconds } from "@/lib/rooms";
import { Dialog } from "./dialog";

export function GameDetails({ title = "รายละเอียดเกม", close }: { title?: string; close: () => void }) {
  return (
    <Dialog className="game-details" title={title} close={close}>
      <p className="game-details-intro">Morris Club คือเกมกระดาน Nine Men’s Morris สำหรับสองคน สุ่มหาคู่แข่งหรือสร้างห้องแล้วชวนเพื่อนด้วยรหัส 6 ตัว</p>
        <ol className="rules">
          <li><strong>วางหมาก</strong><p>ผลัดกันวางหมากคนละ 1 ตัวลงในจุดว่าง แต่ละฝ่ายมีหมาก 9 ตัว</p></li>
          <li><strong>สร้างมิลล์และจับหมาก</strong><p>เรียงหมากสีเดียวกัน 3 ตัวตามเส้นแนวนอนหรือแนวตั้ง แล้วนำหมากคู่แข่งออก 1 ตัว หมากในมิลล์จะถูกป้องกัน เว้นแต่หมากของคู่แข่งทุกตัวอยู่ในมิลล์</p></li>
          <li><strong>เลื่อนหรือบิน</strong><p>เมื่อวางหมากครบ ให้เลื่อนหมากไปยังจุดว่างที่ติดกันตามเส้น เมื่อเหลือ 3 ตัว สามารถบินไปยังจุดว่างใดก็ได้</p></li>
          <li><strong>ชนะเกม</strong><p>หลังวางครบทั้งสองฝ่าย คุณชนะเมื่อคู่แข่งเหลือน้อยกว่า 3 ตัว หรือไม่มีตาเดินที่ถูกกติกา</p></li>
        </ol>
      <p className="game-details-clock">มีเวลา {turnSeconds} วินาทีต่อตา รวมช่วงจับหมาก ถ้าหมดเวลาอีกฝ่ายชนะ</p>
      <footer className="game-details-credit">สร้างโดย <strong>skydev</strong></footer>
    </Dialog>
  );
}
