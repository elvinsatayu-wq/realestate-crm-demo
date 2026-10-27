# Real Estate CRM System

ระบบบริหารจัดการลูกค้าโครงการอสังหาริมทรัพย์ ครอบคลุม Pipeline **Lead → Walk In → Book → Transfer**
Backend: Node.js + Express · Frontend: HTML + Tailwind CSS + JavaScript (ES Modules) + Chart.js + flatpickr

## เริ่มต้นใช้งาน

```bash
npm install
npm start            # http://localhost:3000
```

| คำสั่ง | รายละเอียด |
| --- | --- |
| `npm start` | รันเซิร์ฟเวอร์ บันทึกข้อมูลลง `data/db.json` |
| `npm run dev` | รันพร้อม auto-reload เมื่อแก้โค้ด (Node 18.11+) |
| `npm run start:memory` | รันแบบ In-Memory (ข้อมูลหายเมื่อปิดเซิร์ฟเวอร์) เหมาะสำหรับทดสอบ |
| `npm run seed` | ล้างข้อมูลและสร้างข้อมูลตัวอย่างใหม่ |

ครั้งแรกที่รัน ระบบจะสร้างข้อมูลตัวอย่าง (Lead 120, Walk In 90, Booking/Transfer ตามจริง) ให้อัตโนมัติ
ตัวแปรแวดล้อม: `PORT`, `DB_FILE` (ตำแหน่งไฟล์ JSON), `DB_MODE=memory`,
`AUTH_SECRET` (คีย์เซ็น token — ถ้าไม่ตั้ง ระบบสร้างไว้ที่ `data/.auth-secret`), `COOKIE_SECURE=true` (เมื่อใช้ผ่าน HTTPS)

## บัญชีผู้ใช้เริ่มต้น

> ⚠ เป็นรหัสผ่านสำหรับทดลองใช้งาน — เปลี่ยนทันทีที่หน้า **ผู้ใช้งาน** (Admin)

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin1234` | Admin |
| `manager` | `manager1234` | Manager |
| `sales1` – `sales4` | `sales1234` | Sales |

## สิทธิ์การใช้งาน (RBAC)

| | Admin | Manager | Sales |
| --- | :-: | :-: | :-: |
| Dashboard | ทั้งหมด + ยอดเงิน + ผลงานทีม | ทั้งหมด + ยอดเงิน + ผลงานทีม | เฉพาะของตนเอง |
| Lead / Walk In (ดู/บันทึก/แก้ไข/ลบ) | ทุกรายการ | ทุกรายการ | เฉพาะที่ได้รับมอบหมาย |
| มอบหมายลูกค้า (Assign) | ✓ | ✓ | – (บันทึกใหม่ = ของตนเองอัตโนมัติ) |
| Booking / Transfer (ดู/บันทึก/อัปเดต) | ✓ | ✓ | – |
| ลบ Booking / Transfer | ✓ | – | – |
| จัดการผู้ใช้งาน | ✓ | – | – |

- สิทธิ์ทั้งหมดตรวจที่ **เซิร์ฟเวอร์** ทุก API และทุกหน้า (`src/auth.js` → `PERMISSIONS`) ส่วนหน้าเว็บซ่อนเมนู/ปุ่มตามรายการสิทธิ์เดียวกันจาก `/api/auth/me`
- Session: JWT (HS256) ใน HttpOnly cookie อายุ 12 ชั่วโมง · รหัสผ่านเก็บแบบ scrypt hash
- เปลี่ยนรหัสผ่าน/บทบาท หรือปิดการใช้งาน → token เดิมของผู้ใช้นั้นใช้ไม่ได้ทันที
- ล็อกอินผิด 5 ครั้ง → ระงับชื่อผู้ใช้นั้น (จาก IP เดิม) 5 นาที
- ข้อมูลเดิมก่อนมีระบบสิทธิ์: Walk In จับคู่ผู้รับผิดชอบจากชื่อฝ่ายขาย, Booking/Transfer ตาม Walk In ต้นทาง, Lead เดิมเป็น "ยังไม่มอบหมาย" (Admin/Manager มอบหมายได้)

## โครงสร้างโปรเจกต์

```
├── server.js                 # Express app: API + static files + error handler
├── src/
│   ├── db.js                 # JSON-file / in-memory database
│   ├── schemas.js            # ตัวเลือก dropdown + schema + validation (ใช้ร่วมกับ frontend)
│   ├── seed.js               # สร้างข้อมูลตัวอย่าง
│   └── routes/
│       ├── api.js            # รวม route + business rules ของ Booking/Transfer
│       ├── resource.js       # CRUD router แบบ generic (+ กรองช่วงวันที่)
│       └── dashboard.js      # สรุปภาพรวม / trend / funnel
├── public/
│   ├── index.html            # Dashboard
│   ├── leads.html · walkins.html · bookings.html · transfers.html
│   ├── css/app.css           # component classes (card, form, table, modal)
│   └── js/
│       ├── tailwind.config.js
│       ├── core/             # api, date-filter, layout, ui, charts, crud, icons
│       └── pages/            # สคริปต์ประจำแต่ละหน้า
└── data/db.json              # ไฟล์ข้อมูล (สร้างอัตโนมัติ)
```

## Global Date Filter

- ทุกหน้ามี Preset (วันนี้, 7/30/90 วัน, เดือนนี้, ไตรมาส, ปี, ทั้งหมด) และ Date Range Picker แบบกำหนดเอง
- ช่วงวันที่ถูกเก็บใน URL (`?preset=30d` หรือ `?from=…&to=…`) และ `localStorage`
  → ลิงก์ในเมนู/ปุ่มทางลัดพาช่วงวันที่ไปทุกหน้า, เปิดหลายแท็บก็ sync กันอัตโนมัติ, แชร์ลิงก์ได้
- Preset แบบสัมพัทธ์ (เช่น 30 วันล่าสุด) คำนวณใหม่ทุกครั้งที่เปิด จึงไม่ค้างวันที่เก่า

## Business rules

- **Booking** ดึงชื่อ/เบอร์จาก Walk In ได้ (หรือกดปุ่ม "จอง" จากตาราง Walk In) และเก็บ `walkinId` ไว้อ้างอิง
- **Transfer** เลือกจากรายการจองที่สถานะ "จองแล้ว" → ระบบคัดลอกข้อมูลโครงการ/แปลง/ราคา และเปลี่ยนสถานะการจองเป็น "โอนแล้ว"
- ลบรายการโอน → การจองกลับเป็น "จองแล้ว" · ลบการจองที่มีการโอนแล้วไม่ได้ · หนึ่งการจองโอนได้ครั้งเดียว
- ทุก API ตรวจสอบข้อมูลฝั่งเซิร์ฟเวอร์ (ฟิลด์บังคับ, ค่า dropdown, ตัวเลข, รูปแบบวันที่)

## REST API

| Method | Endpoint | |
| --- | --- | --- |
| POST | `/api/auth/login` · `/api/auth/logout` | เข้า/ออกจากระบบ |
| GET | `/api/auth/me` | ผู้ใช้ปัจจุบัน + รายการสิทธิ์ |
| GET/POST/PUT/DELETE | `/api/users` | จัดการผู้ใช้ (Admin) · `/api/users/directory` รายชื่อสำหรับ dropdown |
| GET | `/api/options` | ตัวเลือก dropdown ทั้งหมด |
| GET | `/api/dashboard?from&to` | สรุปภาพรวม |
| GET | `/api/{leads\|walkins\|bookings\|transfers}?from&to` | รายการตามช่วงวันที่ |
| GET/PUT/DELETE | `/api/{resource}/:id` | อ่าน / แก้ไข / ลบ |
| POST | `/api/{resource}` | เพิ่มข้อมูล |

> หมายเหตุ: Tailwind โหลดผ่าน Play CDN เพื่อความสะดวกในการพัฒนา ถ้าจะใช้งานจริงควร build ด้วย Tailwind CLI
