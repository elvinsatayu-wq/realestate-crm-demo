/**
 * Dropdown options + field schemas shared by the API (validation)
 * and the frontend (served through GET /api/options).
 */

const OPTIONS = {
  budgets: ['8-10 ล้าน', '10-12 ล้าน', '12-15 ล้าน', '15-20 ล้าน', 'มากกว่า 20 ล้าน'],
  leadChannels: ['Facebook', 'Instagram', 'Website', 'Call in'],
  leadStatuses: ['นัดหมายเข้าชม', 'สอบถามรายละเอียด', 'ติดต่อไม่ได้', 'ไม่รับสาย', 'ไม่สนใจ'],
  mediaChannels: ['Facebook', 'Instagram', 'Website', 'ป้ายบอกทาง', 'บิลบอร์ด'],
  genders: ['ชาย', 'หญิง', 'LGBTQ'],
  occupations: ['ธุรกิจส่วนตัว', 'พนักงานบริษัท', 'ข้าราชการ', 'รัฐวิสาหกิจ', 'อาชีพอิสระ', 'เกษียณ'],
  visitReasons: ['ทำเลดี', 'ฟังก์ชันบ้าน', 'ราคาบ้าน', 'โปรโมชันของแถม', 'สิ่งที่ประทับใจในโครงการ'],
  promotions: ['ส่วนลด', 'ฟรีส่วนกลาง', 'ฟรีเฟอร์นิเจอร์'],
  grades: [
    { value: 'A', label: 'Grade A : ตัดสินใจจอง' },
    { value: 'B', label: 'Grade B : สนใจ มีการต่อรองราคาและคุยรายละเอียด' },
    { value: 'C', label: 'Grade C : สอบถามข้อมูลเพื่อพิจารณา ไม่รีบซื้อในตอนนี้' },
    { value: 'D', label: 'Grade D : ลูกค้าไม่มีศักยภาพในการซื้อ หรือไม่ถูกใจโครงการ' },
  ],
  salesTeam: ['คุณสมชาย ใจดี', 'คุณวิภาวดี รุ่งเรือง', 'คุณณัฐพล ศรีวงศ์', 'คุณปริยา แก้วมณี'],
  projects: ['The Grand Residence', 'Villa Serene', 'Parkview Estate'],
  paymentMethods: ['เงินสด', 'ขอสินเชื่อ'],
  bookingStatuses: ['จองแล้ว', 'โอนแล้ว', 'ยกเลิก'],
  banks: [
    'ธนาคารกรุงเทพ',
    'ธนาคารกสิกรไทย',
    'ธนาคารกรุงไทย',
    'ธนาคารไทยพาณิชย์',
    'ธนาคารกรุงศรีอยุธยา',
    'ธนาคารทหารไทยธนชาต (ttb)',
    'ธนาคารอาคารสงเคราะห์ (ธอส.)',
    'ธนาคารยูโอบี',
    'ธนาคารซีไอเอ็มบี ไทย',
    'เงินสด (ไม่ใช้สินเชื่อ)',
  ],
};

const LABELS = {
  date: 'วันที่',
  time: 'เวลา',
  name: 'ชื่อลูกค้า',
  channel: 'ช่องทางที่ลงทะเบียน',
  phone: 'หมายเลขติดต่อ',
  lineId: 'Line ID',
  budget: 'งบประมาณ',
  detail: 'รายละเอียด',
  status: 'สถานะ',
  media: 'ช่องทางรับรู้สื่อ',
  gender: 'เพศ',
  age: 'อายุ',
  occupation: 'อาชีพ',
  income: 'รายได้ต่อเดือน',
  residents: 'จำนวนผู้อยู่อาศัย',
  reasons: 'เหตุผลที่เข้าชมโครงการ',
  route: 'เส้นทางการเดินทาง',
  homeDistrict: 'เขตที่อยู่อาศัย',
  workDistrict: 'เขตที่ทำงาน',
  promotions: 'โปรโมชันที่สนใจ',
  grade: 'สถานะลูกค้า (Grade)',
  salesperson: 'ฝ่ายขายที่รับผิดชอบ',
  walkinId: 'Walk In',
  project: 'โครงการที่จอง',
  plot: 'แปลงที่จอง',
  price: 'ราคาแปลงที่จอง',
  deposit: 'จำนวนเงินจอง',
  paymentMethod: 'วิธีการซื้อ',
  bookingId: 'รายการจอง',
  netAmount: 'ยอดโอนสุทธิ',
  bank: 'ธนาคาร',
  cashBack: 'เงินเหลือให้ลูกค้า (Cash Back)',
  note: 'หมายเหตุ',
  followups: 'บันทึกการติดตาม',
  assignedTo: 'ผู้รับผิดชอบ',
};

// Field types: string | date | time | number | enum:<optionKey> | array:<optionKey>
//              | followups (list of { date, note })
const SCHEMAS = {
  leads: {
    required: ['date', 'name', 'channel', 'status'],
    fields: {
      date: 'date',
      name: 'string',
      channel: 'enum:leadChannels',
      phone: 'string',
      lineId: 'string',
      budget: 'enum:budgets',
      detail: 'string',
      followups: 'followups',
      status: 'enum:leadStatuses',
      assignedTo: 'string',
    },
  },
  walkins: {
    required: ['date', 'time', 'name', 'media', 'grade'],
    fields: {
      date: 'date',
      time: 'time',
      media: 'enum:mediaChannels',
      name: 'string',
      phone: 'string',
      lineId: 'string',
      budget: 'enum:budgets',
      gender: 'enum:genders',
      age: 'number',
      occupation: 'enum:occupations',
      income: 'number',
      residents: 'number',
      reasons: 'array:visitReasons',
      route: 'string',
      homeDistrict: 'string',
      workDistrict: 'string',
      promotions: 'array:promotions',
      detail: 'string',
      followups: 'followups',
      grade: 'enum:grades',
      // `salesperson` is the display name, derived from `assignedTo` on save.
      salesperson: 'string',
      assignedTo: 'string',
    },
  },
  bookings: {
    required: ['date', 'name', 'project', 'plot', 'price', 'deposit', 'paymentMethod'],
    fields: {
      date: 'date',
      walkinId: 'string',
      name: 'string',
      phone: 'string',
      project: 'string',
      plot: 'string',
      price: 'number',
      deposit: 'number',
      paymentMethod: 'enum:paymentMethods',
      status: 'enum:bookingStatuses',
      note: 'string',
      assignedTo: 'string',
    },
  },
  transfers: {
    required: ['date', 'bookingId', 'netAmount'],
    fields: {
      date: 'date',
      bookingId: 'string',
      netAmount: 'number',
      bank: 'string',
      cashBack: 'number',
      note: 'string',
    },
  },
};

const allowedValues = (key) => OPTIONS[key].map((o) => (typeof o === 'string' ? o : o.value));

/** Coerces and validates a request body. Unknown fields are dropped. */
function validate(resource, body = {}) {
  const schema = SCHEMAS[resource];
  const data = {};
  const errors = [];
  const invalid = new Set();

  for (const [field, type] of Object.entries(schema.fields)) {
    const [kind, optionKey] = type.split(':');
    const label = LABELS[field] || field;
    const raw = body[field];

    if (kind === 'followups') {
      // Fully empty rows are dropped; half-filled rows are reported.
      const list = Array.isArray(raw) ? raw : [];
      data[field] = [];
      list.forEach((item, i) => {
        const date = String(item?.date ?? '').trim();
        const note = String(item?.note ?? '').trim().slice(0, 2000);
        if (!date && !note) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
          errors.push(`${label} ครั้งที่ ${i + 1}: กรุณาระบุวันที่`);
        } else if (!note) {
          errors.push(`${label} ครั้งที่ ${i + 1}: กรุณากรอกรายละเอียด`);
        } else data[field].push({ date, note });
      });
      continue;
    }

    if (kind === 'array') {
      const list = Array.isArray(raw) ? raw : raw == null || raw === '' ? [] : [raw];
      const allowed = allowedValues(optionKey);
      const unknown = list.filter((v) => !allowed.includes(v));
      if (unknown.length) errors.push(`${label}: ค่าไม่ถูกต้อง (${unknown.join(', ')})`);
      data[field] = [...new Set(list.filter((v) => allowed.includes(v)))];
      continue;
    }

    const value = raw == null ? '' : String(raw).trim();
    if (value === '') {
      data[field] = kind === 'number' ? null : '';
      continue;
    }

    switch (kind) {
      case 'number': {
        const n = Number(value.replace(/,/g, ''));
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`${label} ต้องเป็นตัวเลขที่ไม่ติดลบ`);
          invalid.add(field);
        } else data[field] = n;
        break;
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
          errors.push(`${label} ไม่ถูกต้อง (รูปแบบ YYYY-MM-DD)`);
          invalid.add(field);
        } else data[field] = value;
        break;
      case 'time':
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
          errors.push(`${label} ไม่ถูกต้อง (รูปแบบ HH:MM)`);
          invalid.add(field);
        } else data[field] = value;
        break;
      case 'enum':
        if (!allowedValues(optionKey).includes(value)) {
          errors.push(`${label}: "${value}" ไม่อยู่ในตัวเลือก`);
          invalid.add(field);
        } else data[field] = value;
        break;
      default:
        data[field] = value.slice(0, 2000);
    }
  }

  for (const field of schema.required) {
    if (invalid.has(field)) continue;
    const v = data[field];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) {
      errors.push(`กรุณาระบุ${LABELS[field] || field}`);
    }
  }

  return { data, errors };
}

module.exports = { OPTIONS, SCHEMAS, LABELS, validate };
