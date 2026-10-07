const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ==============================
// الإعدادات
// ==============================

const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود.');
  process.exit(1);
}

// ==============================
// البوت
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// ==============================
// ملف البيانات
// ==============================

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );
  } catch (error) {
    console.error('⚠️ ملف البيانات تالف، سيتم إنشاء ملف جديد.');
    data = {};
  }
}

// ==============================
// الحفظ
// ==============================

let saveTimer = null;

function saveSoon() {
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;

    try {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('❌ خطأ في حفظ البيانات:', error);
    }
  }, 3000);
}

function saveNow() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('❌ خطأ في حفظ البيانات:', error);
  }
}

// ==============================
// بيانات العضو
// ==============================

function getMemberData(guildId, userId) {
  if (!data[guildId]) {
    data[guildId] = {};
  }

  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      messages: 0,
      voiceSeconds: 0,
      voiceStarted: null,
      memberNumber: null
    };
  }

  // دعم البيانات القديمة
  if (!('memberNumber' in data[guildId][userId])) {
    data[guildId][userId].memberNumber = null;
  }

  if (!('messages' in data[guildId][userId])) {
    data[guildId][userId].messages = 0;
  }

  if (!('voiceSeconds' in data[guildId][userId])) {
    data[guildId][userId].voiceSeconds = 0;
  }

  if (!('voiceStarted' in data[guildId][userId])) {
    data[guildId][userId].voiceStarted = null;
  }

  return data[guildId][userId];
}

// ==============================
// رقم العضو التلقائي
// ==============================

function assignMemberNumber(guildId, userId) {
  const memberData = getMemberData(guildId, userId);

  // لو العضو عنده رقم بالفعل
  // يفضل الرقم ثابت
  if (
    memberData.memberNumber !== null &&
    Number(memberData.memberNumber) > 0
  ) {
    return Number(memberData.memberNumber);
  }

  if (!data[guildId]) {
    data[guildId] = {};
  }

  const numbers = Object.values(data[guildId])
    .map(member => Number(member.memberNumber) || 0)
    .filter(number => number > 0);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  memberData.memberNumber = nextNumber;

  saveSoon();

  return nextNumber;
}

// ==============================
// أدوات
// ==============================

function escapeXML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function fitText(text, max) {
  text = String(text || '');

  if (text.length <= max) {
    return text;
  }

  return text.substring(0, max - 3) + '...';
}

// ==============================
// التاريخ
// ==============================

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return 'غير معروف';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// ==============================
// عمر الحساب
// ==============================

function getAccountAge(createdAt) {
  if (!createdAt) {
    return 'غير معروف';
  }

  const now = new Date();

  let months =
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
    (now.getMonth() - createdAt.getMonth());

  if (now.getDate() < createdAt.getDate()) {
    months--;
  }

  months = Math.max(0, months);

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths > 0) {
      return `${years} سنة و ${remainingMonths} شهر`;
    }

    return `${years} سنة`;
  }

  if (months > 0) {
    return `${months} شهور`;
  }

  return 'أقل من شهر';
}

// ==============================
// مدة العضوية
// ==============================

function getMembershipTime(joinedAt) {
  if (!joinedAt) {
    return 'غير معروف';
  }

  const difference = Math.max(
    0,
    Date.now() - joinedAt.getTime()
  );

  const totalHours = Math.floor(
    difference / 3600000
  );

  const days = Math.floor(
    totalHours / 24
  );

  const hours = totalHours % 24;

  return `${formatNumber(days)} يوم و ${formatNumber(hours)} ساعة`;
}

// ==============================
// وقت الفويس
// ==============================

function formatVoiceTime(seconds) {
  seconds = Math.max(
    0,
    Number(seconds || 0)
  );

  const days = Math.floor(
    seconds / 86400
  );

  seconds %= 86400;

  const hours = Math.floor(
    seconds / 3600
  );

  seconds %= 3600;

  const minutes = Math.floor(
    seconds / 60
  );

  if (days > 0) {
    return `${days} يوم و ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}

// ==============================
// حالة العضو
// ==============================

function getStatus(member) {
  const status =
    member.presence?.status || 'offline';

  if (status === 'online') {
    return {
      text: 'متصل',
      color: '#43B581'
    };
  }

  if (status === 'idle') {
    return {
      text: 'خامل',
      color: '#FAA61A'
    };
  }

  if (status === 'dnd') {
    return {
      text: 'مشغول',
      color: '#F04747'
    };
  }

  return {
    text: 'غير متصل',
    color: '#747F8D'
  };
}

// ==============================
// الأفاتار
// ==============================

async function getAvatar(member) {
  try {
    const url = member.displayAvatarURL({
      extension: 'png',
      size: 512,
      forceStatic: true
    });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Avatar HTTP ${response.status}`
      );
    }

    return Buffer.from(
      await response.arrayBuffer()
    );
  } catch (error) {
    console.error(
      '⚠️ فشل تحميل الأفاتار:',
      error.message
    );

    return null;
  }
}

// ==============================
// إنشاء صورة DNA
// ==============================

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const WIDTH = 1400;
  const HEIGHT = 1400;

  const avatar = await getAvatar(member);

  const status = getStatus(member);

  const name = fitText(
    member.displayName ||
    member.user.globalName ||
    member.user.username,
    20
  );

  const username = fitText(
    member.user.username,
    27
  );

  const membership =
    getMembershipTime(member.joinedAt);

  const accountAge =
    getAccountAge(member.user.createdAt);

  const joinDate =
    formatDate(member.joinedAt);

  const accountDate =
    formatDate(member.user.createdAt);

  const roles = Math.max(
    0,
    member.roles.cache.size - 1
  );

  const messages =
    Number(memberData.messages || 0);

  let voiceSeconds =
    Number(memberData.voiceSeconds || 0);

  if (memberData.voiceStarted) {
    voiceSeconds += Math.floor(
      (
        Date.now() -
        Number(memberData.voiceStarted)
      ) / 1000
    );
  }

  const voice =
    formatVoiceTime(voiceSeconds);

  const safeName =
    escapeXML(name);

  const safeUsername =
    escapeXML(username);

  const safeID =
    escapeXML(member.user.id);

  const safeStatus =
    escapeXML(status.text);

  const safeMembership =
    escapeXML(membership);

  const safeAccountAge =
    escapeXML(accountAge);

  const safeJoinDate =
    escapeXML(joinDate);

  const safeAccountDate =
    escapeXML(accountDate);

  const safeVoice =
    escapeXML(voice);

  // ==============================
  // الأفاتار
  // ==============================

  let avatarBase64 = '';

  if (avatar) {
    avatarBase64 =
      `data:image/png;base64,${avatar.toString('base64')}`;
  }

  // ==============================
  // SVG
  // ==============================

  const svg = `
<svg
  width="${WIDTH}"
  height="${HEIGHT}"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  xmlns="http://www.w3.org/2000/svg"
>

  <defs>

    <linearGradient
      id="bg"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0%" stop-color="#080B12"/>
      <stop offset="50%" stop-color="#101722"/>
      <stop offset="100%" stop-color="#05070C"/>
    </linearGradient>

    <linearGradient
      id="card"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0%" stop-color="#151C29"/>
      <stop offset="100%" stop-color="#0C111A"/>
    </linearGradient>

    <linearGradient
      id="line"
      x1="0"
      y1="0"
      x2="1"
      y2="0"
    >
      <stop offset="0%" stop-color="#5865F2"/>
      <stop offset="50%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#5865F2"/>
    </linearGradient>

    <filter
      id="shadow"
      x="-50%"
      y="-50%"
      width="200%"
      height="200%"
    >
      <feDropShadow
        dx="0"
        dy="10"
        stdDeviation="15"
        flood-color="#000000"
        flood-opacity="0.45"
      />
    </filter>

    <clipPath id="avatarClip">
      <circle
        cx="195"
        cy="280"
        r="124"
      />
    </clipPath>

  </defs>

  <!-- ========================== -->
  <!-- الخلفية -->
  <!-- ========================== -->

  <rect
    width="${WIDTH}"
    height="${HEIGHT}"
    fill="url(#bg)"
  />

  <rect
    x="25"
    y="25"
    width="1350"
    height="1350"
    rx="38"
    fill="none"
    stroke="#202938"
    stroke-width="2"
  />

  <!-- ========================== -->
  <!-- العنوان -->
  <!-- ========================== -->

  <text
    x="70"
    y="90"
    fill="#FFFFFF"
    font-size="38"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    NEON DNA
  </text>

  <text
    x="70"
    y="120"
    fill="#727D90"
    font-size="17"
    font-weight="600"
    font-family="Arial, sans-serif"
  >
    MEMBER IDENTITY CARD
  </text>

  <rect
    x="65"
    y="130"
    width="1270"
    height="2"
    fill="url(#line)"
  />

  <!-- ========================== -->
  <!-- PROFILE -->
  <!-- ========================== -->

  <rect
    x="65"
    y="145"
    width="1270"
    height="255"
    rx="28"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
    filter="url(#shadow)"
  />

  <!-- إطار الأفاتار -->

  <circle
    cx="195"
    cy="280"
    r="139"
    fill="#090D14"
    stroke="#5865F2"
    stroke-width="4"
  />

  <circle
    cx="195"
    cy="280"
    r="130"
    fill="#111827"
    stroke="#303A4D"
    stroke-width="2"
  />

  ${
    avatarBase64
      ? `
      <image
        href="${avatarBase64}"
        x="71"
        y="156"
        width="248"
        height="248"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
      `
      : `
      <circle
        cx="195"
        cy="280"
        r="124"
        fill="#5865F2"
      />

      <text
        x="195"
        y="300"
        fill="#FFFFFF"
        font-size="75"
        font-weight="900"
        text-anchor="middle"
        font-family="Arial, sans-serif"
      >
        ${escapeXML(
          (name || '?')
            .charAt(0)
            .toUpperCase()
        )}
      </text>
      `
  }

  <!-- نقطة الحالة -->

  <circle
    cx="290"
    cy="374"
    r="23"
    fill="#0B1018"
    stroke="#202938"
    stroke-width="3"
  />

  <circle
    cx="290"
    cy="374"
    r="14"
    fill="${status.color}"
  />

  <!-- الاسم -->

  <text
    x="355"
    y="218"
    fill="#FFFFFF"
    font-size="31"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeName}
  </text>

  <!-- اليوزر -->

  <text
    x="357"
    y="251"
    fill="#8994A7"
    font-size="18"
    font-weight="600"
    font-family="Arial, sans-serif"
  >
    @${safeUsername}
  </text>

  <!-- ========================== -->
  <!-- رقم العضو -->
  <!-- ========================== -->

  <rect
    x="355"
    y="273"
    width="360"
    height="45"
    rx="14"
    fill="#111827"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="375"
    y="302"
    fill="#8B95A7"
    font-size="18"
    font-weight="700"
    font-family="Arial, sans-serif"
  >
    رقم العضو
  </text>

  <text
    x="690"
    y="302"
    fill="#FFFFFF"
    font-size="19"
    font-weight="900"
    text-anchor="end"
    font-family="Arial, sans-serif"
  >
    #${memberNumber}
  </text>

  <!-- ========================== -->
  <!-- حالة العضو -->
  <!-- ========================== -->

  <rect
    x="355"
    y="328"
    width="360"
    height="45"
    rx="14"
    fill="#111827"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="375"
    y="357"
    fill="#8B95A7"
    font-size="18"
    font-weight="700"
    font-family="Arial, sans-serif"
  >
    حالة العضو
  </text>

  <circle
    cx="635"
    cy="350"
    r="9"
    fill="${status.color}"
  />

  <text
    x="660"
    y="357"
    fill="#FFFFFF"
    font-size="18"
    font-weight="800"
    font-family="Arial, sans-serif"
  >
    ${safeStatus}
  </text>

  <!-- ========================== -->
  <!-- ملف العضو -->
  <!-- ========================== -->

  <rect
    x="790"
    y="175"
    width="505"
    height="190"
    rx="22"
    fill="#0E141E"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="825"
    y="220"
    fill="#FFFFFF"
    font-size="25"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ملف العضو
  </text>

  <text
    x="825"
    y="248"
    fill="#778398"
    font-size="15"
    font-weight="600"
    font-family="Arial, sans-serif"
  >
    بطاقة تعريف العضو
  </text>

  <rect
    x="825"
    y="267"
    width="435"
    height="2"
    fill="#263244"
  />

  <text
    x="825"
    y="300"
    fill="#8994A7"
    font-size="15"
    font-family="Arial, sans-serif"
  >
    ID
  </text>

  <text
    x="1260"
    y="300"
    fill="#FFFFFF"
    font-size="15"
    font-weight="700"
    text-anchor="end"
    font-family="Arial, sans-serif"
  >
    ${safeID}
  </text>

  <text
    x="825"
    y="330"
    fill="#8994A7"
    font-size="15"
    font-family="Arial, sans-serif"
  >
    بيانات وإحصائيات العضو
  </text>

  <!-- ========================== -->
  <!-- الإحصائيات -->
  <!-- ========================== -->

  <text
    x="70"
    y="455"
    fill="#FFFFFF"
    font-size="26"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    إحصائيات العضو
  </text>

  <!-- BOX 1 -->

  <rect
    x="65"
    y="480"
    width="400"
    height="145"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="95"
    y="520"
    fill="#7F8A9D"
    font-size="17"
    font-family="Arial, sans-serif"
  >
    الرسائل
  </text>

  <text
    x="95"
    y="570"
    fill="#FFFFFF"
    font-size="34"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${formatNumber(messages)}
  </text>

  <!-- BOX 2 -->

  <rect
    x="500"
    y="480"
    width="400"
    height="145"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="530"
    y="520"
    fill="#7F8A9D"
    font-size="17"
    font-family="Arial, sans-serif"
  >
    الرتب
  </text>

  <text
    x="530"
    y="570"
    fill="#FFFFFF"
    font-size="34"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${formatNumber(roles)}
  </text>

  <!-- BOX 3 -->

  <rect
    x="935"
    y="480"
    width="400"
    height="145"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="965"
    y="520"
    fill="#7F8A9D"
    font-size="17"
    font-family="Arial, sans-serif"
  >
    وقت الصوت
  </text>

  <text
    x="965"
    y="570"
    fill="#FFFFFF"
    font-size="24"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeVoice}
  </text>

  <!-- ========================== -->
  <!-- بيانات الحساب -->
  <!-- ========================== -->

  <text
    x="70"
    y="680"
    fill="#FFFFFF"
    font-size="26"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    بيانات الحساب
  </text>

  <!-- حساب ديسكورد -->

  <rect
    x="65"
    y="705"
    width="620"
    height="115"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="95"
    y="745"
    fill="#7F8A9D"
    font-size="16"
    font-family="Arial, sans-serif"
  >
    عمر حساب ديسكورد
  </text>

  <text
    x="95"
    y="785"
    fill="#FFFFFF"
    font-size="22"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeAccountAge}
  </text>

  <!-- تاريخ إنشاء الحساب -->

  <rect
    x="715"
    y="705"
    width="620"
    height="115"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="745"
    y="745"
    fill="#7F8A9D"
    font-size="16"
    font-family="Arial, sans-serif"
  >
    تاريخ إنشاء الحساب
  </text>

  <text
    x="745"
    y="785"
    fill="#FFFFFF"
    font-size="22"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeAccountDate}
  </text>

  <!-- ========================== -->
  <!-- السيرفر -->
  <!-- ========================== -->

  <text
    x="70"
    y="875"
    fill="#FFFFFF"
    font-size="26"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    بيانات السيرفر
  </text>

  <!-- الانضمام -->

  <rect
    x="65"
    y="900"
    width="400"
    height="125"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="95"
    y="940"
    fill="#7F8A9D"
    font-size="16"
    font-family="Arial, sans-serif"
  >
    تاريخ دخول السيرفر
  </text>

  <text
    x="95"
    y="980"
    fill="#FFFFFF"
    font-size="21"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeJoinDate}
  </text>

  <!-- مدة العضوية -->

  <rect
    x="500"
    y="900"
    width="400"
    height="125"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="530"
    y="940"
    fill="#7F8A9D"
    font-size="16"
    font-family="Arial, sans-serif"
  >
    مدة العضوية
  </text>

  <text
    x="530"
    y="980"
    fill="#FFFFFF"
    font-size="21"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeMembership}
  </text>

  <!-- رقم الديسكورد -->

  <rect
    x="935"
    y="900"
    width="400"
    height="125"
    rx="22"
    fill="url(#card)"
    stroke="#263244"
    stroke-width="2"
  />

  <text
    x="965"
    y="940"
    fill="#7F8A9D"
    font-size="16"
    font-family="Arial, sans-serif"
  >
    Discord ID
  </text>

  <text
    x="965"
    y="980"
    fill="#FFFFFF"
    font-size="18"
    font-weight="900"
    font-family="Arial, sans-serif"
  >
    ${safeID}
  </text>

  <!-- ========================== -->
  <!-- الفوتر -->
  <!-- ========================== -->

  <rect
    x="65"
    y="1070"
    width="1270"
    height="2"
    fill="url(#line)"
  />

  <text
    x="700"
    y="1120"
    fill="#5865F2"
    font-size="28"
    font-weight="900"
    text-anchor="middle"
    font-family="Arial, sans-serif"
  >
    ELZRAZIR
  </text>

  <text
    x="700"
    y="1150"
    fill="#697589"
    font-size="15"
    text-anchor="middle"
    font-family="Arial, sans-serif"
  >
    NEON DNA • MEMBER CARD
  </text>

  <text
    x="700"
    y="1210"
    fill="#3E485A"
    font-size="13"
    text-anchor="middle"
    font-family="Arial, sans-serif"
  >
    ${safeID}
  </text>

</svg>
`;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

// ==============================
// أمر DNA
// ==============================

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة NEON DNA وإحصائيات العضو'
    )
].map(command => command.toJSON());

// ==============================
// تسجيل الأمر
// ==============================

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('⏳ تسجيل أوامر البوت...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log('✅ تم تسجيل أمر /dna');
  } catch (error) {
    console.error(
      '❌ خطأ في تسجيل الأوامر:',
      error
    );
  }
}

// ==============================
// تشغيل البوت
// ==============================

client.once('ready', async () => {
  console.log(
    `✅ البوت يعمل باسم: ${client.user.tag}`
  );

  console.log(
    `📌 قناة DNA: ${DNA_CHANNEL_ID}`
  );

  await registerCommands();

  // تحديث حالة الفويس
  for (const guild of client.guilds.cache.values()) {
    for (const member of guild.members.cache.values()) {

      if (member.user.bot) {
        continue;
      }

      const memberData =
        getMemberData(
          guild.id,
          member.id
        );

      if (member.voice?.channelId) {
        memberData.voiceStarted =
          Date.now();
      } else {
        memberData.voiceStarted = null;
      }
    }
  }

  saveNow();
});

// ==============================
// الرسائل
// ==============================

client.on(
  'messageCreate',
  message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    const memberData =
      getMemberData(
        message.guild.id,
        message.author.id
      );

    memberData.messages++;

    saveSoon();
  }
);

// ==============================
// الفويس
// ==============================

client.on(
  'voiceStateUpdate',
  (oldState, newState) => {

    if (!newState.guild) {
      return;
    }

    const member =
      newState.member ||
      oldState.member;

    if (!member || member.user.bot) {
      return;
    }

    const memberData =
      getMemberData(
        newState.guild.id,
        member.id
      );

    // دخل فويس
    if (
      !oldState.channelId &&
      newState.channelId
    ) {
      memberData.voiceStarted =
        Date.now();

      saveSoon();

      return;
    }

    // خرج من الفويس
    if (
      oldState.channelId &&
      !newState.channelId
    ) {
      if (memberData.voiceStarted) {

        const seconds = Math.floor(
          (
            Date.now() -
            Number(memberData.voiceStarted)
          ) / 1000
        );

        memberData.voiceSeconds +=
          Math.max(0, seconds);
      }

      memberData.voiceStarted = null;

      saveSoon();

      return;
    }

    // نقل من روم لروم
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      memberData.voiceStarted =
        Date.now();

      saveSoon();
    }
  }
);

// ==============================
// التفاعل مع /dna
// ==============================

client.on(
  'interactionCreate',
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName !== 'dna') {
      return;
    }

    // السماح بالأمر في قناة DNA فقط
    if (
      interaction.channelId !==
      DNA_CHANNEL_ID
    ) {

      return interaction.reply({
        content:
          `❌ استخدم الأمر داخل قناة بطاقات الأعضاء فقط: <#${DNA_CHANNEL_ID}>`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {

      await interaction.deferReply();

      const member =
        await interaction.guild.members.fetch(
          interaction.user.id
        );

      // بيانات العضو
      const memberData =
        getMemberData(
          interaction.guild.id,
          member.id
        );

      // رقم العضو تلقائي وثابت
      const memberNumber =
        assignMemberNumber(
          interaction.guild.id,
          member.id
        );

      // إنشاء الصورة
      const image =
        await createDNAImage(
          member,
          memberData,
          memberNumber
        );

      const file =
        new AttachmentBuilder(
          image,
          {
            name:
              `NEON-DNA-${member.user.id}.png`
          }
        );

      await interaction.editReply({
        files: [file]
      });

    } catch (error) {

      console.error(
        '❌ خطأ أثناء إنشاء البطاقة:',
        error
      );

      try {

        await interaction.editReply({
          content:
            '❌ حدث خطأ أثناء إنشاء بطاقة العضو.'
        });

      } catch {}
    }
  }
);

// ==============================
// حفظ عند إغلاق البوت
// ==============================

process.on(
  'SIGINT',
  () => {
    saveNow();
    process.exit(0);
  }
);

process.on(
  'SIGTERM',
  () => {
    saveNow();
    process.exit(0);
  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '❌ uncaughtException:',
      error
    );

    saveNow();
  }
);

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '❌ unhandledRejection:',
      error
    );

    saveNow();
  }
);

// ==============================
// تسجيل الدخول
// ==============================

client.login(TOKEN);
