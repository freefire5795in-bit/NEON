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

// ═════════════════════════════════════════════
// NEON SETTINGS
// ═════════════════════════════════════════════

const CLIENT_ID = '1557370938650271824';

const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود.');
  process.exit(1);
}

// ═════════════════════════════════════════════
// CLIENT
// ═════════════════════════════════════════════

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

// ═════════════════════════════════════════════
// DATABASE
// ═════════════════════════════════════════════

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

function saveData() {
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

function getMemberData(guildId, userId) {
  if (!data[guildId]) {
    data[guildId] = {};
  }

  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      messages: 0,
      voiceSeconds: 0,
      voiceStarted: null
    };
  }

  return data[guildId][userId];
}

// ═════════════════════════════════════════════
// XML ESCAPE
// ═════════════════════════════════════════════

function escapeXML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ═════════════════════════════════════════════
// LTR TEXT
// مهم جدًا للتواريخ والأرقام
// ═════════════════════════════════════════════

function ltr(value) {
  return `\u200E${String(value)}\u200E`;
}

// ═════════════════════════════════════════════
// مدة العضوية
// مثال: 16 يوم و 17 ساعة
// ═════════════════════════════════════════════

function getMembershipTime(joinedAt) {
  if (!joinedAt) {
    return 'غير معروف';
  }

  const elapsed = Math.max(
    0,
    Date.now() - joinedAt.getTime()
  );

  const totalHours = Math.floor(
    elapsed / 3600000
  );

  const days = Math.floor(
    totalHours / 24
  );

  const hours = totalHours % 24;

  return `${ltr(days)} يوم و ${ltr(hours)} ساعة`;
}

// ═════════════════════════════════════════════
// عمر الحساب
// ═════════════════════════════════════════════

function getAccountAge(createdAt) {
  if (!createdAt) {
    return 'غير معروف';
  }

  const totalDays = Math.floor(
    Math.max(
      0,
      Date.now() - createdAt.getTime()
    ) / 86400000
  );

  const years = Math.floor(totalDays / 365);

  if (years > 0) {
    return `${ltr(years)} سنة`;
  }

  const months = Math.floor(totalDays / 30);

  if (months > 0) {
    return `${ltr(months)} شهر`;
  }

  return `${ltr(totalDays)} يوم`;
}

// ═════════════════════════════════════════════
// وقت الفويس
// ═════════════════════════════════════════════

function formatVoiceTime(seconds) {
  seconds = Math.max(
    0,
    Math.floor(seconds)
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
    return `${ltr(days)} يوم و ${ltr(hours)} ساعة`;
  }

  if (hours > 0) {
    return `${ltr(hours)} ساعة و ${ltr(minutes)} دقيقة`;
  }

  return `${ltr(minutes)} دقيقة`;
}

// ═════════════════════════════════════════════
// حالة العضو
// ═════════════════════════════════════════════

function getMemberStatus(member) {
  const status = member.presence?.status;

  if (status === 'online') {
    return {
      text: 'متصل',
      color: '#35e06f'
    };
  }

  if (status === 'idle') {
    return {
      text: 'خامل',
      color: '#f0b429'
    };
  }

  if (status === 'dnd') {
    return {
      text: 'مشغول',
      color: '#ff4141'
    };
  }

  return {
    text: 'غير متصل',
    color: '#777777'
  };
}

// ═════════════════════════════════════════════
// رقم العضو
// يتم ترتيبه حسب تاريخ دخول السيرفر
// ═════════════════════════════════════════════

async function getMemberNumber(guild, target) {
  try {
    const members = await guild.members.fetch();

    const humans = [...members.values()]
      .filter(member => !member.user.bot)
      .filter(member => member.joinedTimestamp)
      .sort(
        (a, b) =>
          a.joinedTimestamp - b.joinedTimestamp
      );

    const index = humans.findIndex(
      member => member.id === target.id
    );

    return index === -1
      ? humans.length + 1
      : index + 1;

  } catch (error) {
    console.error(
      '⚠️ مشكلة في حساب رقم العضو:',
      error
    );

    return 1;
  }
}

// ═════════════════════════════════════════════
// التاريخ
// النتيجة دائمًا:
// 20/09/2026
// ═════════════════════════════════════════════

function formatDate(date) {
  if (!date) {
    return 'غير معروف';
  }

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const year = String(
    date.getFullYear()
  );

  return `${day}/${month}/${year}`;
}

// ═════════════════════════════════════════════
// تقصير النص
// ═════════════════════════════════════════════

function fitText(text, max = 22) {
  text = String(text ?? '');

  if (text.length <= max) {
    return text;
  }

  return (
    text.substring(0, max - 3) +
    '...'
  );
}

// ═════════════════════════════════════════════
// حجم اسم المستخدم تلقائي
// ═════════════════════════════════════════════

function usernameFontSize(text) {
  const length = String(text).length;

  if (length <= 16) return 38;
  if (length <= 21) return 34;
  if (length <= 26) return 30;
  if (length <= 32) return 27;

  return 24;
}

// ═════════════════════════════════════════════
// إنشاء الصورة
// ═════════════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  const width = 1400;
  const height = 1400;

  // ═══════════════════════════════════════
  // البيانات
  // ═══════════════════════════════════════

  const usernameRaw =
    member.user.username;

  const username =
    escapeXML(usernameRaw);

  const globalNameRaw =
    member.user.globalName ||
    member.user.username;

  const nicknameRaw =
    member.nickname ||
    globalNameRaw;

  const nickname =
    escapeXML(
      fitText(nicknameRaw, 20)
    );

  const status =
    getMemberStatus(member);

  const membership =
    getMembershipTime(
      member.joinedAt
    );

  const accountAge =
    getAccountAge(
      member.user.createdAt
    );

  const joinDate =
    formatDate(
      member.joinedAt
    );

  const accountDate =
    formatDate(
      member.user.createdAt
    );

  const roles =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  const messages =
    Number(
      memberData.messages || 0
    ).toLocaleString('en-US');

  // ═══════════════════════════════════════
  // وقت الفويس
  // ═══════════════════════════════════════

  let voiceSeconds =
    Number(
      memberData.voiceSeconds || 0
    );

  if (memberData.voiceStarted) {
    voiceSeconds += Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          memberData.voiceStarted
        ) / 1000
      )
    );
  }

  const voice =
    formatVoiceTime(
      voiceSeconds
    );

  // ═══════════════════════════════════════
  // AVATAR
  // ═══════════════════════════════════════

  let avatar = '';

  try {
    const avatarURL =
      member.user.displayAvatarURL({
        extension: 'png',
        size: 512
      });

    const response =
      await fetch(avatarURL);

    if (response.ok) {
      avatar =
        Buffer.from(
          await response.arrayBuffer()
        ).toString('base64');
    }

  } catch (error) {
    console.error(
      '⚠️ تعذر تحميل Avatar:',
      error.message
    );
  }

  // ═══════════════════════════════════════
  // AVATAR SVG
  // ═══════════════════════════════════════

  const avatarSVG = avatar
    ? `
      <image
        href="data:image/png;base64,${avatar}"
        x="88"
        y="188"
        width="318"
        height="318"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `
    : `
      <circle
        cx="247"
        cy="347"
        r="159"
        fill="#160303"
      />

      <text
        x="247"
        y="365"
        text-anchor="middle"
        fill="#ff2028"
        font-size="55"
        font-weight="bold"
      >
        NEON
      </text>
    `;

  // ═══════════════════════════════════════
  // STAT BOX
  // ═══════════════════════════════════════

  function statBox(
    x,
    y,
    w,
    h,
    title,
    subtitle,
    value,
    icon,
    valueSize = 27
  ) {

    return `
      <path
        d="
          M${x + 25} ${y}
          H${x + w - 25}
          L${x + w} ${y + 25}
          V${y + h - 25}
          L${x + w - 25} ${y + h}
          H${x + 25}
          L${x} ${y + h - 25}
          V${y + 25}
          Z
        "
        fill="#070707"
        stroke="#a80c15"
        stroke-width="3"
      />

      <text
        x="${x + w / 2}"
        y="${y + 45}"
        text-anchor="middle"
        fill="#ff3038"
        font-size="24"
        font-weight="bold"
        direction="rtl"
        unicode-bidi="plaintext"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 76}"
        text-anchor="middle"
        fill="#8f8f8f"
        font-size="15"
        direction="rtl"
        unicode-bidi="plaintext"
      >
        ${subtitle}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 132}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="${valueSize}"
        font-weight="bold"
        direction="rtl"
        unicode-bidi="plaintext"
      >
        ${value}
      </text>

      <path
        d="
          M${x + w / 2 - 35} ${y + h - 22}
          H${x + w / 2 + 35}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />
    `;
  }

  // ═══════════════════════════════════════
  // SMALL BOX
  // ═══════════════════════════════════════

  function smallBox(
    x,
    y,
    w,
    title,
    value,
    icon,
    valueSize = 21
  ) {

    return `
      <path
        d="
          M${x + 16} ${y}
          H${x + w - 16}
          L${x + w} ${y + 16}
          V${y + 155}
          L${x + w - 16} ${y + 171}
          H${x + 16}
          L${x} ${y + 155}
          V${y + 16}
          Z
        "
        fill="#070707"
        stroke="#8d1017"
        stroke-width="2"
      />

      <text
        x="${x + w / 2}"
        y="${y + 40}"
        text-anchor="middle"
        fill="#ff3038"
        font-size="20"
        font-weight="bold"
        direction="rtl"
        unicode-bidi="plaintext"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 94}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="${valueSize}"
        font-weight="bold"
        direction="rtl"
        unicode-bidi="plaintext"
      >
        ${value}
      </text>

      <path
        d="
          M${x + w / 2 - 22} ${y + 138}
          H${x + w / 2 + 22}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />
    `;
  }

  // ═══════════════════════════════════════
  // SVG
  // ═══════════════════════════════════════

  const svg = `

  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
  >

    <defs>

      <linearGradient
        id="background"
        x1="0"
        y1="0"
        x2="1"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="#020202"
        />

        <stop
          offset="50%"
          stop-color="#170202"
        />

        <stop
          offset="100%"
          stop-color="#020202"
        />
      </linearGradient>

      <linearGradient
        id="redLine"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset="0%"
          stop-color="#3b0004"
        />

        <stop
          offset="50%"
          stop-color="#ff2028"
        />

        <stop
          offset="100%"
          stop-color="#3b0004"
        />
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur
          stdDeviation="4"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <clipPath id="avatarClip">
        <circle
          cx="247"
          cy="347"
          r="159"
        />
      </clipPath>

    </defs>

    <!-- ═════════ BACKGROUND ═════════ -->

    <rect
      width="${width}"
      height="${height}"
      rx="40"
      fill="url(#background)"
    />

    <circle
      cx="1280"
      cy="120"
      r="290"
      fill="#ff0000"
      opacity=".045"
    />

    <circle
      cx="100"
      cy="1320"
      r="250"
      fill="#ff0000"
      opacity=".04"
    />

    <!-- ═════════ FRAME ═════════ -->

    <path
      d="
        M28 145
        L88 118
        H1312
        L1372 145
        V1285
        L1312 1315
        H88
        L28 1285
        Z
      "
      fill="none"
      stroke="url(#redLine)"
      stroke-width="5"
      filter="url(#glow)"
    />

    <rect
      x="48"
      y="160"
      width="1304"
      height="1105"
      fill="none"
      stroke="#62070c"
      stroke-width="2"
    />

    <!-- ═════════ HEADER ═════════ -->

    <text
      x="78"
      y="66"
      fill="#ff2525"
      font-size="48"
      font-weight="bold"
    >
      ♛ NEON
    </text>

    <text
      x="80"
      y="94"
      fill="#aaa"
      font-size="17"
      letter-spacing="5"
    >
      DISCORD SERVER
    </text>

    <text
      x="1070"
      y="52"
      fill="#ff2525"
      font-size="21"
      text-anchor="middle"
      font-weight="bold"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      أكثر من مجرد سيرفر
    </text>

    <text
      x="1070"
      y="82"
      fill="#aaa"
      font-size="18"
      text-anchor="middle"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      نحن عائلة واحدة
    </text>

    <path
      d="M70 122H1330"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <!-- ═════════ AVATAR ═════════ -->

    <circle
      cx="247"
      cy="347"
      r="178"
      fill="#050505"
      stroke="#4c0005"
      stroke-width="10"
    />

    <circle
      cx="247"
      cy="347"
      r="166"
      fill="none"
      stroke="#ff151c"
      stroke-width="7"
      filter="url(#glow)"
    />

    <circle
      cx="247"
      cy="347"
      r="160"
      fill="none"
      stroke="#8c0a10"
      stroke-width="2"
    />

    ${avatarSVG}

    <!-- ═════════ STATUS DOT ═════════ -->

    <circle
      cx="367"
      cy="467"
      r="28"
      fill="#050505"
      stroke="#ff2025"
      stroke-width="4"
    />

    <circle
      cx="367"
      cy="467"
      r="16"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <!-- ═════════ USER INFO ═════════ -->

    <text
      x="455"
      y="258"
      fill="#ffffff"
      font-size="${usernameFontSize(usernameRaw)}"
      font-weight="bold"
      direction="ltr"
      unicode-bidi="plaintext"
    >
      ${username}
    </text>

    <text
      x="455"
      y="295"
      fill="#999"
      font-size="19"
      direction="ltr"
      unicode-bidi="plaintext"
    >
      @${username}
    </text>

    <!-- MEMBER NUMBER -->

    <path
      d="
        M455 320
        H810
        L830 340
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <text
      x="790"
      y="346"
      text-anchor="end"
      fill="#ff252d"
      font-size="18"
      font-weight="bold"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      ♛ رقم العضو
    </text>

    <text
      x="480"
      y="346"
      fill="#ffffff"
      font-size="25"
      font-weight="bold"
      direction="ltr"
      unicode-bidi="plaintext"
    >
      #${memberNumber}
    </text>

    <!-- STATUS -->

    <path
      d="
        M455 365
        H810
        L830 385
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <circle
      cx="480"
      cy="400"
      r="8"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="505"
      y="407"
      fill="#999"
      font-size="17"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      حالة العضو
    </text>

    <text
      x="625"
      y="407"
      fill="${status.color}"
      font-size="20"
      font-weight="bold"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      ${escapeXML(status.text)}
    </text>

    <!-- ═════════ PROFILE BOX ═════════ -->

    <path
      d="
        M880 190
        H1260
        L1290 220
        V400
        L1260 430
        H880
        L850 400
        V220
        Z
      "
      fill="#080606"
      stroke="#ff2025"
      stroke-width="3"
    />

    <text
      x="1070"
      y="275"
      text-anchor="middle"
      fill="#ff3038"
      font-size="35"
      font-weight="bold"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      ملف العضو
    </text>

    <text
      x="1070"
      y="315"
      text-anchor="middle"
      fill="#ccc"
      font-size="20"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      بطاقة تعريف العضو
    </text>

    <path
      d="M940 350H1200"
      stroke="url(#redLine)"
      stroke-width="4"
    />

    <text
      x="1070"
      y="390"
      text-anchor="middle"
      fill="#777"
      font-size="15"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      بطاقة بيانات وإحصائيات العضو
    </text>

    <!-- ═════════ MAIN STATS ═════════ -->

    ${statBox(
      55,
      465,
      405,
      205,
      'مدة العضوية',
      'مدة وجود العضو داخل السيرفر',
      escapeXML(membership),
      '▦',
      26
    )}

    ${statBox(
      497,
      465,
      405,
      205,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${ltr(messages)} رسالة`,
      '✉',
      27
    )}

    ${statBox(
      939,
      465,
      405,
      205,
      'وقت المكالمات',
      'إجمالي وقت وجود العضو في الفويس',
      escapeXML(voice),
      '♫',
      24
    )}

    <!-- ═════════ SMALL ROW 1 ═════════ -->

    ${smallBox(
      55,
      705,
      305,
      'حالة العضو',
      escapeXML(status.text),
      '♥'
    )}

    ${smallBox(
      380,
      705,
      305,
      'ترتيب العضو',
      `#${memberNumber}`,
      '♙',
      21
    )}

    ${smallBox(
      705,
      705,
      305,
      'عدد الرتب',
      `${ltr(roles)} رتبة`,
      '◇'
    )}

    ${smallBox(
      1030,
      705,
      314,
      'عمر الحساب',
      escapeXML(accountAge),
      '◉'
    )}

    <!-- ═════════ SMALL ROW 2 ═════════ -->

    ${smallBox(
      55,
      900,
      405,
      'اسم العضو',
      nickname,
      '♟',
      20
    )}

    ${smallBox(
      497,
      900,
      405,
      'تاريخ الانضمام',
      `<tspan direction="ltr" unicode-bidi="bidi-override">${joinDate}</tspan>`,
      '◇',
      21
    )}

    ${smallBox(
      939,
      900,
      405,
      'تاريخ إنشاء الحساب',
      `<tspan direction="ltr" unicode-bidi="bidi-override">${accountDate}</tspan>`,
      '◷',
      21
    )}

    <!-- ═════════ SMALL ROW 3 ═════════ -->

    ${smallBox(
      55,
      1095,
      630,
      'معرّف العضو',
      `<tspan direction="ltr" unicode-bidi="bidi-override">${member.user.id}</tspan>`,
      '#',
      19
    )}

    ${smallBox(
      705,
      1095,
      639,
      'اسم المستخدم',
      `<tspan direction="ltr" unicode-bidi="bidi-override">${escapeXML(fitText(usernameRaw, 25))}</tspan>`,
      '♛',
      20
    )}

    <!-- ═════════ FOOTER ═════════ -->

    <path
      d="M55 1290H1345"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <text
      x="700"
      y="1330"
      text-anchor="middle"
      fill="#ff2525"
      font-size="38"
      font-weight="bold"
    >
      ♛ NEON
    </text>

    <text
      x="700"
      y="1357"
      text-anchor="middle"
      fill="#777"
      font-size="15"
      direction="rtl"
      unicode-bidi="plaintext"
    >
      بطاقة العضو • الإحصائيات • البيانات
    </text>

  </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

// ═════════════════════════════════════════════
// SLASH COMMAND
// ═════════════════════════════════════════════

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة العضو وإحصائياته'
    )
].map(command => command.toJSON());

// ═════════════════════════════════════════════
// REGISTER COMMAND
// ═════════════════════════════════════════════

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('🔄 جاري تسجيل /dna...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(
      '✅ تم تسجيل /dna بنجاح.'
    );

  } catch (error) {
    console.error(
      '❌ خطأ في تسجيل الأمر:',
      error
    );
  }
}

// ═════════════════════════════════════════════
// READY
// ═════════════════════════════════════════════

client.once(
  'ready',
  async () => {

    console.log(
      `✅ البوت يعمل باسم: ${client.user.tag}`
    );

    console.log(
      `📌 قناة DNA: ${DNA_CHANNEL_ID}`
    );

    await registerCommands();
  }
);

// ═════════════════════════════════════════════
// MESSAGE COUNTER
// ═════════════════════════════════════════════

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

    saveData();
  }
);

// ═════════════════════════════════════════════
// VOICE TRACKER
// ═════════════════════════════════════════════

client.on(
  'voiceStateUpdate',
  (oldState, newState) => {

    if (!newState.guild) {
      return;
    }

    const memberData =
      getMemberData(
        newState.guild.id,
        newState.id
      );

    // دخول الفويس
    if (
      !oldState.channel &&
      newState.channel
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }

    // الخروج من الفويس
    if (
      oldState.channel &&
      !newState.channel
    ) {

      if (memberData.voiceStarted) {

        memberData.voiceSeconds +=
          Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                memberData.voiceStarted
              ) / 1000
            )
          );
      }

      memberData.voiceStarted = null;

      saveData();

      return;
    }

    // انتقال بين الرومات
    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !==
      newState.channel.id
    ) {

      if (!memberData.voiceStarted) {
        memberData.voiceStarted =
          Date.now();
      }

      saveData();
    }
  }
);

// ═════════════════════════════════════════════
// /DNA
// ═════════════════════════════════════════════

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (
      interaction.commandName !== 'dna'
    ) {
      return;
    }

    // ═════════════════════════════
    // قناة DNA فقط
    // ═════════════════════════════

    if (
      interaction.channelId !==
      DNA_CHANNEL_ID
    ) {

      return interaction.reply({
        content:
          `❌ استخدم الأمر داخل قناة بطاقات الأعضاء فقط: <#${DNA_CHANNEL_ID}>`,
        flags:
          MessageFlags.Ephemeral
      });
    }

    try {

      await interaction.deferReply();

      const member =
        await interaction.guild.members.fetch(
          interaction.user.id
        );

      const memberData =
        getMemberData(
          interaction.guild.id,
          member.id
        );

      const memberNumber =
        await getMemberNumber(
          interaction.guild,
          member
        );

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
        '❌ خطأ أثناء إنشاء بطاقة DNA:',
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

// ═════════════════════════════════════════════
// SAVE ON SHUTDOWN
// ═════════════════════════════════════════════

process.on(
  'SIGINT',
  () => {
    saveData();
    process.exit(0);
  }
);

process.on(
  'SIGTERM',
  () => {
    saveData();
    process.exit(0);
  }
);

// ═════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════

client.login(TOKEN);
