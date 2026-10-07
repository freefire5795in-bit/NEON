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

// ═══════════════════════════════════════
// إعدادات NEON
// ═══════════════════════════════════════

const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ متغير DISCORD_TOKEN غير موجود.');
  process.exit(1);
}

// ═══════════════════════════════════════
// البوت
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// قاعدة البيانات
// ═══════════════════════════════════════

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );
  } catch {
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
    console.error('❌ خطأ أثناء حفظ البيانات:', error);
  }
}

function getMemberData(guildId, userId) {
  data[guildId] ??= {};

  data[guildId][userId] ??= {
    messages: 0,
    voiceSeconds: 0,
    voiceStarted: null
  };

  return data[guildId][userId];
}

// ═══════════════════════════════════════
// تحويل الأرقام للعربية
// ═══════════════════════════════════════

function arabicNumbers(value) {
  return String(value)
    .replace(/0/g, '٠')
    .replace(/1/g, '١')
    .replace(/2/g, '٢')
    .replace(/3/g, '٣')
    .replace(/4/g, '٤')
    .replace(/5/g, '٥')
    .replace(/6/g, '٦')
    .replace(/7/g, '٧')
    .replace(/8/g, '٨')
    .replace(/9/g, '٩');
}

// ═══════════════════════════════════════
// حماية SVG
// ═══════════════════════════════════════

function escapeXML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ═══════════════════════════════════════
// مدة العضوية
// مثال: ١٦ يوم و ١٧ ساعة
// ═══════════════════════════════════════

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

  return `${arabicNumbers(days)} يوم و ${arabicNumbers(hours)} ساعة`;
}

// ═══════════════════════════════════════
// عمر الحساب
// ═══════════════════════════════════════

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

  const years = Math.floor(
    totalDays / 365
  );

  if (years > 0) {
    return `${arabicNumbers(years)} سنة`;
  }

  const months = Math.floor(
    totalDays / 30
  );

  if (months > 0) {
    return `${arabicNumbers(months)} شهر`;
  }

  return `${arabicNumbers(totalDays)} يوم`;
}

// ═══════════════════════════════════════
// وقت المكالمات
// ═══════════════════════════════════════

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
    return `${arabicNumbers(days)} يوم و ${arabicNumbers(hours)} ساعة`;
  }

  if (hours > 0) {
    return `${arabicNumbers(hours)} ساعة و ${arabicNumbers(minutes)} دقيقة`;
  }

  return `${arabicNumbers(minutes)} دقيقة`;
}

// ═══════════════════════════════════════
// حالة العضو
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// رقم العضو
// يعتمد على ترتيب دخول الأعضاء
// ═══════════════════════════════════════

async function getMemberNumber(guild, target) {
  try {
    const members = await guild.members.fetch();

    const humans = [
      ...members.values()
    ]
      .filter(member => !member.user.bot)
      .filter(member => member.joinedTimestamp)
      .sort(
        (a, b) =>
          a.joinedTimestamp - b.joinedTimestamp
      );

    const index = humans.findIndex(
      member => member.id === target.id
    );

    if (index === -1) {
      return humans.length + 1;
    }

    return index + 1;

  } catch (error) {
    console.error(
      '⚠️ تعذر حساب رقم العضو:',
      error.message
    );

    return 1;
  }
}

// ═══════════════════════════════════════
// التاريخ
// ═══════════════════════════════════════

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

  const year = date.getFullYear();

  return arabicNumbers(
    `${day}/${month}/${year}`
  );
}

// ═══════════════════════════════════════
// تقصير النص
// ═══════════════════════════════════════

function fitText(text, max = 22) {
  text = String(text);

  if (text.length <= max) {
    return text;
  }

  return (
    text.substring(0, max - 3) +
    '...'
  );
}

// ═══════════════════════════════════════
// إنشاء بطاقة DNA
// ═══════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  // حجم البطاقة الجديد
  const width = 1400;
  const height = 1500;

  // ═════════════════════════════════════
  // بيانات العضو
  // ═════════════════════════════════════

  const username = escapeXML(
    member.user.username
  );

  const tag = escapeXML(
    member.user.tag ||
    member.user.username
  );

  const nickname = escapeXML(
    member.nickname ||
    member.user.globalName ||
    member.user.username
  );

  const status = getMemberStatus(member);

  const membership = getMembershipTime(
    member.joinedAt
  );

  const accountAge = getAccountAge(
    member.user.createdAt
  );

  const joinDate = formatDate(
    member.joinedAt
  );

  const accountDate = formatDate(
    member.user.createdAt
  );

  // عدد الرتب بدون @everyone
  const roles = Math.max(
    0,
    member.roles.cache.size - 1
  );

  const messagesNumber =
    Number(memberData.messages || 0);

  const messages =
    arabicNumbers(
      messagesNumber.toLocaleString('en-US')
    );

  // ═════════════════════════════════════
  // وقت الفويس
  // ═════════════════════════════════════

  let voiceSeconds =
    Number(memberData.voiceSeconds || 0);

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

  const voice = formatVoiceTime(
    voiceSeconds
  );

  // ═════════════════════════════════════
  // صورة العضو
  // ═════════════════════════════════════

  let avatar = '';

  try {

    const avatarURL =
      member.user.displayAvatarURL({
        extension: 'png',
        size: 256
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
      '⚠️ تعذر تحميل صورة العضو:',
      error.message
    );
  }

  const avatarSVG = avatar

    ? `
      <image
        href="data:image/png;base64,${avatar}"
        x="92"
        y="190"
        width="310"
        height="310"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `

    : `
      <circle
        cx="247"
        cy="345"
        r="155"
        fill="#160303"
      />

      <text
        x="247"
        y="365"
        text-anchor="middle"
        fill="#ff2028"
        font-size="65"
        font-weight="bold"
      >
        NEON
      </text>
    `;

  // ═════════════════════════════════════
  // الخانات الرئيسية
  // ═════════════════════════════════════

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
        y="${y + 48}"
        text-anchor="middle"
        fill="#ff3038"
        font-size="25"
        font-weight="bold"
        direction="rtl"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 80}"
        text-anchor="middle"
        fill="#8f8f8f"
        font-size="15"
        direction="rtl"
      >
        ${subtitle}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 140}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="${valueSize}"
        font-weight="bold"
        direction="rtl"
      >
        ${value}
      </text>

      <path
        d="
          M${x + w / 2 - 38} ${y + h - 22}
          H${x + w / 2 + 38}
        "
        stroke="#ff202d"
        stroke-width="5"
        stroke-linecap="round"
      />
    `;
  }

  // ═════════════════════════════════════
  // الخانات الصغيرة
  // ═════════════════════════════════════

  function smallBox(
    x,
    y,
    w,
    h,
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
          V${y + h - 16}
          L${x + w - 16} ${y + h}
          H${x + 16}
          L${x} ${y + h - 16}
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
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 96}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="${valueSize}"
        font-weight="bold"
        direction="rtl"
      >
        ${value}
      </text>

      <path
        d="
          M${x + w / 2 - 24} ${y + h - 30}
          H${x + w / 2 + 24}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />
    `;
  }

  // ═════════════════════════════════════
  // SVG
  // ═════════════════════════════════════

  const svg = `

  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
  >

    <defs>

      <!-- الخلفية -->

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

      <!-- الخط الأحمر -->

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

      <!-- توهج -->

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

      <!-- دائرة الصورة -->

      <clipPath id="avatarClip">

        <circle
          cx="247"
          cy="345"
          r="155"
        />

      </clipPath>

    </defs>

    <!-- ═════════════════════════════════ -->
    <!-- الخلفية -->
    <!-- ═════════════════════════════════ -->

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
      cy="1370"
      r="250"
      fill="#ff0000"
      opacity=".04"
    />

    <!-- ═════════════════════════════════ -->
    <!-- الإطار الخارجي -->
    <!-- ═════════════════════════════════ -->

    <path
      d="
        M28 145
        L88 118
        H1312
        L1372 145
        V1370
        L1312 1400
        H88
        L28 1370
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
      height="1210"
      fill="none"
      stroke="#62070c"
      stroke-width="2"
    />

    <!-- ═════════════════════════════════ -->
    <!-- العنوان -->
    <!-- ═════════════════════════════════ -->

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
    >
      D I S C O R D   S E R V E R
    </text>

    <text
      x="1070"
      y="52"
      fill="#ff2525"
      font-size="21"
      text-anchor="middle"
      font-weight="bold"
      direction="rtl"
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
    >
      نحن عائلة واحدة
    </text>

    <path
      d="M70 122H1330"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <!-- ═════════════════════════════════ -->
    <!-- صورة العضو -->
    <!-- ═════════════════════════════════ -->

    <circle
      cx="247"
      cy="345"
      r="178"
      fill="#050505"
      stroke="#4c0005"
      stroke-width="10"
    />

    <circle
      cx="247"
      cy="345"
      r="165"
      fill="none"
      stroke="#ff151c"
      stroke-width="7"
      filter="url(#glow)"
    />

    <circle
      cx="247"
      cy="345"
      r="157"
      fill="none"
      stroke="#8c0a10"
      stroke-width="2"
    />

    ${avatarSVG}

    <!-- حالة العضو على الصورة -->

    <circle
      cx="367"
      cy="465"
      r="27"
      fill="#050505"
      stroke="#ff2025"
      stroke-width="4"
    />

    <circle
      cx="367"
      cy="465"
      r="16"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <!-- ═════════════════════════════════ -->
    <!-- معلومات العضو -->
    <!-- ═════════════════════════════════ -->

    <text
      x="455"
      y="265"
      fill="#ffffff"
      font-size="40"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="455"
      y="300"
      fill="#999"
      font-size="20"
    >
      @${tag}
    </text>

    <!-- رقم العضو -->

    <path
      d="
        M455 325
        H810
        L830 345
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <text
      x="480"
      y="357"
      fill="#ff252d"
      font-size="19"
      font-weight="bold"
      direction="rtl"
    >
      ♛ رقم العضو
    </text>

    <text
      x="790"
      y="357"
      fill="#ffffff"
      font-size="27"
      font-weight="bold"
      text-anchor="end"
    >
      #${arabicNumbers(memberNumber)}
    </text>

    <!-- حالة العضو -->

    <path
      d="
        M455 375
        H810
        L830 395
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <circle
      cx="482"
      cy="410"
      r="8"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="505"
      y="417"
      fill="#999"
      font-size="18"
      direction="rtl"
    >
      حالة العضو
    </text>

    <text
      x="625"
      y="417"
      fill="${status.color}"
      font-size="21"
      font-weight="bold"
      direction="rtl"
    >
      ${status.text}
    </text>

    <!-- ═════════════════════════════════ -->
    <!-- ملف العضو -->
    <!-- ═════════════════════════════════ -->

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
      y="280"
      text-anchor="middle"
      fill="#ff3038"
      font-size="35"
      font-weight="bold"
      direction="rtl"
    >
      ملف العضو
    </text>

    <text
      x="1070"
      y="320"
      text-anchor="middle"
      fill="#ccc"
      font-size="21"
      direction="rtl"
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
    >
      بطاقة بيانات وإحصائيات العضو
    </text>

    <!-- ═════════════════════════════════ -->
    <!-- الإحصائيات الرئيسية -->
    <!-- ═════════════════════════════════ -->

    ${statBox(
      55,
      465,
      405,
      205,
      'مدة العضوية',
      'مدة وجود العضو داخل السيرفر',
      membership,
      '▦',
      27
    )}

    ${statBox(
      497,
      465,
      405,
      205,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${messages} رسالة`,
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
      voice,
      '♫',
      24
    )}

    <!-- ═════════════════════════════════ -->
    <!-- الصف الأول -->
    <!-- ═════════════════════════════════ -->

    ${smallBox(
      55,
      705,
      305,
      171,
      'حالة العضو',
      status.text,
      '♥',
      22
    )}

    ${smallBox(
      380,
      705,
      305,
      171,
      'ترتيب العضو',
      `#${arabicNumbers(memberNumber)}`,
      '♙',
      22
    )}

    ${smallBox(
      705,
      705,
      305,
      171,
      'عدد الرتب',
      `${arabicNumbers(roles)} رتبة`,
      '◇',
      22
    )}

    ${smallBox(
      1030,
      705,
      314,
      171,
      'عمر الحساب',
      accountAge,
      '◉',
      21
    )}

    <!-- ═════════════════════════════════ -->
    <!-- الصف الثاني -->
    <!-- ═════════════════════════════════ -->

    ${smallBox(
      55,
      905,
      405,
      171,
      'اسم العضو',
      fitText(nickname, 22),
      '♟',
      20
    )}

    ${smallBox(
      497,
      905,
      405,
      171,
      'تاريخ الانضمام',
      joinDate,
      '◇',
      21
    )}

    ${smallBox(
      939,
      905,
      405,
      171,
      'تاريخ إنشاء الحساب',
      accountDate,
      '◷',
      21
    )}

    <!-- ═════════════════════════════════ -->
    <!-- الصف الثالث -->
    <!-- ═════════════════════════════════ -->

    ${smallBox(
      55,
      1105,
      630,
      171,
      'معرّف العضو',
      member.user.id,
      '#',
      20
    )}

    ${smallBox(
      705,
      1105,
      639,
      171,
      'اسم المستخدم',
      fitText(member.user.username, 25),
      '♛',
      20
    )}

    <!-- ═════════════════════════════════ -->
    <!-- الخط السفلي -->
    <!-- ═════════════════════════════════ -->

    <path
      d="M55 1310H1345"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <text
      x="700"
      y="1350"
      text-anchor="middle"
      fill="#ff2525"
      font-size="38"
      font-weight="bold"
    >
      ♛ NEON
    </text>

    <text
      x="700"
      y="1380"
      text-anchor="middle"
      fill="#777"
      font-size="15"
      direction="rtl"
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

// ═══════════════════════════════════════
// أمر /dna
// ═══════════════════════════════════════

const commands = [

  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة العضو وإحصائياته'
    )

].map(command =>
  command.toJSON()
);

// ═══════════════════════════════════════
// تسجيل الأمر
// ═══════════════════════════════════════

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

async function registerCommands() {

  try {

    console.log(
      '🔄 جاري تسجيل أمر /dna...'
    );

    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      '✅ تم تسجيل أمر /dna بنجاح.'
    );

  } catch (error) {

    console.error(
      '❌ خطأ في تسجيل الأمر:',
      error
    );
  }
}

// ═══════════════════════════════════════
// تشغيل البوت
// ═══════════════════════════════════════

client.once(
  'ready',
  async () => {

    console.log(
      `✅ البوت يعمل باسم: ${client.user.tag}`
    );

    console.log(
      `📌 قناة بطاقات الأعضاء: ${DNA_CHANNEL_ID}`
    );

    // استعادة وقت الفويس للأعضاء الموجودين حاليًا
    for (const guild of client.guilds.cache.values()) {

      try {

        const members =
          await guild.members.fetch();

        for (const member of members.values()) {

          if (
            member.user.bot ||
            !member.voice?.channel
          ) {
            continue;
          }

          const memberData =
            getMemberData(
              guild.id,
              member.id
            );

          if (!memberData.voiceStarted) {
            memberData.voiceStarted =
              Date.now();
          }
        }

      } catch (error) {

        console.error(
          '⚠️ خطأ في استعادة الفويس:',
          error.message
        );
      }
    }

    saveData();

    await registerCommands();
  }
);

// ═══════════════════════════════════════
// حساب الرسائل
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// حساب وقت الفويس
// ═══════════════════════════════════════

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

    // خروج من الفويس

    if (
      oldState.channel &&
      !newState.channel
    ) {

      if (
        memberData.voiceStarted
      ) {

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

    // الانتقال بين رومات الفويس

    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !==
      newState.channel.id
    ) {

      if (
        !memberData.voiceStarted
      ) {

        memberData.voiceStarted =
          Date.now();
      }

      saveData();
    }
  }
);

// ═══════════════════════════════════════
// أمر /dna
// ═══════════════════════════════════════

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (
      interaction.commandName !==
      'dna'
    ) {
      return;
    }

    // لازم الأمر يكون في قناة DNA

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

// ═══════════════════════════════════════
// حفظ البيانات عند إيقاف البوت
// ═══════════════════════════════════════

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

// ═══════════════════════════════════════
// تسجيل الدخول
// ═══════════════════════════════════════

client.login(TOKEN);
