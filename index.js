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
    console.error('❌ خطأ في حفظ البيانات:', error);
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
// حماية النص
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
// الأرقام العربية
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
// مدة العضوية
// مثال: 16 يوم و 17 ساعة
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
    elapsed / (60 * 60 * 1000)
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
// وقت الفويس
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
// رقم العضو داخل السيرفر
// ═══════════════════════════════════════

async function getMemberNumber(guild, target) {

  try {

    const members = await guild.members.fetch();

    const humans = [
      ...members.values()
    ]
      .filter(member => !member.user.bot)
      .sort(
        (a, b) =>
          (a.joinedTimestamp || Infinity) -
          (b.joinedTimestamp || Infinity)
      );

    const index = humans.findIndex(
      member => member.id === target.id
    );

    return index < 0
      ? humans.length
      : index + 1;

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

  return `${arabicNumbers(day)}/${arabicNumbers(month)}/${arabicNumbers(year)}`;
}

// ═══════════════════════════════════════
// تقصير النص
// ═══════════════════════════════════════

function fitText(text, max = 25) {

  text = String(text);

  if (text.length <= max) {
    return text;
  }

  return text.substring(0, max - 3) + '...';
}

// ═══════════════════════════════════════
// إنشاء بطاقة DNA
// ═══════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  // مساحة أكبر حتى لا تتداخل الخانات
  const width = 1400;
  const height = 1600;

  // ═══════════════════════════════
  // البيانات
  // ═══════════════════════════════

  const username = escapeXML(
    member.user.username
  );

  const globalName = escapeXML(
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

  const roles = Math.max(
    0,
    member.roles.cache.size - 1
  );

  const messages = Number(
    memberData.messages || 0
  ).toLocaleString('en-US');

  let voiceSeconds = Number(
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

  const voice = formatVoiceTime(
    voiceSeconds
  );

  // ═══════════════════════════════
  // صورة العضو
  // ═══════════════════════════════

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
      '⚠️ تعذر تحميل صورة العضو:',
      error.message
    );
  }

  const avatarSVG = avatar
    ? `
      <image
        href="data:image/png;base64,${avatar}"
        x="92"
        y="175"
        width="310"
        height="310"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `
    : `
      <circle
        cx="247"
        cy="330"
        r="155"
        fill="#160303"
      />

      <text
        x="247"
        y="350"
        text-anchor="middle"
        fill="#ff2028"
        font-size="55"
        font-weight="bold"
      >
        NEON
      </text>
    `;

  // ═══════════════════════════════
  // الخانة الكبيرة
  // ═══════════════════════════════

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
        ${title} ${icon}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 82}"
        text-anchor="middle"
        fill="#8f8f8f"
        font-size="16"
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
          M${x + w / 2 - 35} ${y + h - 22}
          H${x + w / 2 + 35}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />
    `;
  }

  // ═══════════════════════════════
  // الخانة الصغيرة
  // ═══════════════════════════════

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
      >
        ${title} ${icon}
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
          M${x + w / 2 - 22} ${y + 140}
          H${x + w / 2 + 22}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />
    `;
  }

  // ═══════════════════════════════
  // SVG
  // ═══════════════════════════════

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
          cy="330"
          r="155"
        />

      </clipPath>

    </defs>

    <!-- ═════════ الخلفية ═════════ -->

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
      cy="1450"
      r="250"
      fill="#ff0000"
      opacity=".04"
    />

    <!-- ═════════ الإطار ═════════ -->

    <path
      d="
        M28 145
        L88 118
        H1312
        L1372 145
        V1480
        L1312 1510
        H88
        L28 1480
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
      height="1320"
      fill="none"
      stroke="#62070c"
      stroke-width="2"
    />

    <!-- ═════════ العنوان ═════════ -->

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

    <!-- ═════════ الأفاتار ═════════ -->

    <circle
      cx="247"
      cy="330"
      r="178"
      fill="#050505"
      stroke="#4c0005"
      stroke-width="10"
    />

    <circle
      cx="247"
      cy="330"
      r="165"
      fill="none"
      stroke="#ff151c"
      stroke-width="7"
      filter="url(#glow)"
    />

    <circle
      cx="247"
      cy="330"
      r="157"
      fill="none"
      stroke="#8c0a10"
      stroke-width="2"
    />

    ${avatarSVG}

    <!-- ═════════ حالة العضو بجانب الأفاتار ═════════ -->

    <circle
      cx="365"
      cy="448"
      r="26"
      fill="#050505"
      stroke="#ff2025"
      stroke-width="4"
    />

    <circle
      cx="365"
      cy="448"
      r="15"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <!-- ═════════ اسم المستخدم ═════════ -->

    <text
      x="455"
      y="255"
      fill="#ffffff"
      font-size="40"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="455"
      y="292"
      fill="#999"
      font-size="20"
    >
      @${username}
    </text>

    <!-- ═════════ رقم العضو ═════════ -->

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
      x="590"
      y="347"
      text-anchor="middle"
      fill="#ff252d"
      font-size="19"
      font-weight="bold"
      direction="rtl"
    >
      رقم العضو
    </text>

    <text
      x="785"
      y="347"
      text-anchor="end"
      fill="#ffffff"
      font-size="27"
      font-weight="bold"
    >
      #${arabicNumbers(memberNumber)}
    </text>

    <!-- ═════════ الحالة ═════════ -->

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
      cx="485"
      cy="400"
      r="8"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="520"
      y="407"
      fill="#999"
      font-size="18"
      direction="rtl"
    >
      حالة العضو
    </text>

    <text
      x="700"
      y="407"
      fill="${status.color}"
      font-size="21"
      font-weight="bold"
      direction="rtl"
    >
      ${status.text}
    </text>

    <!-- ═════════ ملف العضو ═════════ -->

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

    <!-- ═════════ الإحصائيات الرئيسية ═════════ -->
    <!-- تبدأ بعد الأفاتار بالكامل -->

    ${statBox(
      55,
      535,
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
      535,
      405,
      205,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${arabicNumbers(messages)} رسالة`,
      '✉',
      27
    )}

    ${statBox(
      939,
      535,
      405,
      205,
      'وقت المكالمات',
      'إجمالي وقت وجود العضو في الفويس',
      voice,
      '♫',
      25
    )}

    <!-- ═════════ الصف الأول ═════════ -->

    ${smallBox(
      55,
      775,
      305,
      'حالة العضو',
      status.text,
      '♥'
    )}

    ${smallBox(
      380,
      775,
      305,
      'ترتيب العضو',
      `#${arabicNumbers(memberNumber)}`,
      '♙'
    )}

    ${smallBox(
      705,
      775,
      305,
      'عدد الرتب',
      `${arabicNumbers(roles)} رتبة`,
      '◇'
    )}

    ${smallBox(
      1030,
      775,
      314,
      'عمر الحساب',
      accountAge,
      '◉'
    )}

    <!-- ═════════ الصف الثاني ═════════ -->

    ${smallBox(
      55,
      970,
      405,
      'اسم العضو',
      fitText(globalName, 22),
      '♟',
      20
    )}

    ${smallBox(
      497,
      970,
      405,
      'تاريخ الانضمام',
      joinDate,
      '◇',
      21
    )}

    ${smallBox(
      939,
      970,
      405,
      'تاريخ إنشاء الحساب',
      accountDate,
      '◷',
      21
    )}

    <!-- ═════════ الصف الثالث ═════════ -->

    ${smallBox(
      55,
      1165,
      630,
      'معرّف العضو',
      member.user.id,
      '#',
      19
    )}

    ${smallBox(
      705,
      1165,
      639,
      'اسم المستخدم',
      fitText(username, 25),
      '♛',
      20
    )}

    <!-- ═════════ معلومات إضافية ═════════ -->

    ${smallBox(
      55,
      1360,
      630,
      'الاسم الظاهر',
      fitText(globalName, 25),
      '✦',
      20
    )}

    ${smallBox(
      705,
      1360,
      639,
      'رقم العضوية',
      `#${arabicNumbers(memberNumber)}`,
      '♛',
      21
    )}

    <!-- ═════════ النهاية ═════════ -->

    <path
      d="M55 1550H1345"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <text
      x="700"
      y="1580"
      text-anchor="middle"
      fill="#ff2525"
      font-size="35"
      font-weight="bold"
    >
      ♛ NEON
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

    // الانتقال بين الرومات

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

    // الأمر يعمل داخل قناة DNA فقط

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
// حفظ البيانات عند الإغلاق
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
