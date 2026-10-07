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

// =========================
// إعدادات البوت
// =========================
const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود في Environment Variables.');
  process.exit(1);
}

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

// =========================
// حفظ البيانات
// =========================
const DATA_FILE = path.join(__dirname, 'data.json');
let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    data = {};
  }
}

let saveTimer = null;

function saveDataSoon() {
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
      console.error('❌ خطأ أثناء حفظ البيانات:', error);
    }
  }, 3000);
}

function saveDataNow() {
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

// =========================
// أدوات النص
// =========================
function escapeXML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function number(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function fitText(value, max = 24) {
  const text = String(value ?? '');

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 3)}...`;
}

// =========================
// التاريخ
// =========================
function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return 'غير معروف';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// =========================
// عمر الحساب الحقيقي
// =========================
function getAccountAge(createdAt) {
  if (!createdAt) {
    return 'غير معروف';
  }

  const now = new Date();

  let years =
    now.getFullYear() -
    createdAt.getFullYear();

  let months =
    now.getMonth() -
    createdAt.getMonth();

  let days =
    now.getDate() -
    createdAt.getDate();

  if (days < 0) {
    months--;

    const previousMonthDays = new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    ).getDate();

    days += previousMonthDays;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years > 0) {
    if (months > 0) {
      return `${years} سنة و ${months} شهر`;
    }

    return `${years} سنة`;
  }

  if (months > 0) {
    if (days > 0) {
      return `${months} شهر و ${days} يوم`;
    }

    return `${months} شهر`;
  }

  if (days > 0) {
    return `${days} يوم`;
  }

  return 'اليوم';
}

// =========================
// مدة العضوية
// =========================
function getMembershipTime(joinedAt) {
  if (!joinedAt) {
    return 'غير معروف';
  }

  const elapsed =
    Math.max(0, Date.now() - joinedAt.getTime());

  const totalHours =
    Math.floor(elapsed / 3600000);

  const days =
    Math.floor(totalHours / 24);

  const hours =
    totalHours % 24;

  return `${number(days)} يوم و ${number(hours)} ساعة`;
}

// =========================
// وقت الفويس
// =========================
function formatVoiceTime(seconds) {
  seconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const days =
    Math.floor(seconds / 86400);

  seconds %= 86400;

  const hours =
    Math.floor(seconds / 3600);

  seconds %= 3600;

  const minutes =
    Math.floor(seconds / 60);

  if (days > 0) {
    return `${number(days)} يوم و ${number(hours)} ساعة`;
  }

  if (hours > 0) {
    return `${number(hours)} ساعة و ${number(minutes)} دقيقة`;
  }

  return `${number(minutes)} دقيقة`;
}

// =========================
// حالة العضو
// =========================
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

// =========================
// رقم العضو
// =========================
async function getMemberNumber(guild, target) {
  try {
    const members =
      await guild.members.fetch();

    const humans =
      [...members.values()]
        .filter(member => !member.user.bot)
        .sort((a, b) => {
          const aTime =
            a.joinedTimestamp ||
            Number.MAX_SAFE_INTEGER;

          const bTime =
            b.joinedTimestamp ||
            Number.MAX_SAFE_INTEGER;

          return aTime - bTime;
        });

    const index =
      humans.findIndex(
        member => member.id === target.id
      );

    return index >= 0
      ? index + 1
      : humans.length;

  } catch (error) {
    console.error(
      '⚠️ تعذر حساب رقم العضو:',
      error
    );

    return 1;
  }
}

// =========================
// تحميل الأفاتار
// =========================
async function getAvatarData(member) {
  try {
    const url =
      member.user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true
      });

    const response =
      await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Avatar HTTP ${response.status}`
      );
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    const png =
      await sharp(buffer)
        .resize(512, 512, {
          fit: 'cover',
          position: 'centre'
        })
        .png()
        .toBuffer();

    return `data:image/png;base64,${png.toString('base64')}`;

  } catch (error) {
    console.error(
      '⚠️ تعذر تحميل الأفاتار:',
      error
    );

    return null;
  }
}

// =========================
// إنشاء بطاقة NEON
// =========================
async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const width = 1400;
  const height = 1400;

  const avatarData =
    await getAvatarData(member);

  const displayName =
    fitText(
      member.displayName ||
      member.user.globalName ||
      member.user.username,
      24
    );

  const username =
    fitText(
      member.user.username,
      28
    );

  const memberId =
    member.user.id;

  const status =
    getMemberStatus(member);

  const membership =
    getMembershipTime(member.joinedAt);

  const accountAge =
    getAccountAge(
      member.user.createdAt
    );

  const joinDate =
    formatDate(member.joinedAt);

  const accountDate =
    formatDate(
      member.user.createdAt
    );

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  const messages =
    number(memberData.messages);

  let voiceSeconds =
    Number(
      memberData.voiceSeconds || 0
    );

  if (memberData.voiceStarted) {
    voiceSeconds += Math.max(
      0,
      Math.floor(
        (Date.now() -
          Number(memberData.voiceStarted)) /
          1000
      )
    );
  }

  const voice =
    formatVoiceTime(
      voiceSeconds
    );

  const safeName =
    escapeXML(displayName);

  const safeUsername =
    escapeXML(username);

  const safeMemberId =
    escapeXML(memberId);

  const avatarCircle =
    avatarData
      ? `
        <defs>
          <clipPath id="avatarClip">
            <circle
              cx="205"
              cy="285"
              r="145"
            />
          </clipPath>
        </defs>

        <image
          href="${avatarData}"
          x="60"
          y="140"
          width="290"
          height="290"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `
      : `
        <circle
          cx="205"
          cy="285"
          r="145"
          fill="#111"
        />

        <text
          x="205"
          y="305"
          text-anchor="middle"
          font-size="48"
          fill="#777"
          font-family="Arial, Tahoma, sans-serif"
        >
          NEON
        </text>
      `;

  // =========================
  // الصناديق
  // =========================
  const box = (
    x,
    y,
    w,
    h,
    title,
    value,
    subtitle = ''
  ) => `
    <g>

      <path
        d="
          M ${x + 24} ${y}
          H ${x + w - 24}
          L ${x + w} ${y + 24}
          V ${y + h - 24}
          L ${x + w - 24} ${y + h}
          H ${x + 24}
          L ${x} ${y + h - 24}
          V ${y + 24}
          Z
        "
        fill="#050505"
        stroke="#ff1f2d"
        stroke-width="2"
      />

      <text
        x="${x + w / 2}"
        y="${y + 42}"
        text-anchor="middle"
        direction="rtl"
        font-family="Arial, Tahoma, sans-serif"
        font-size="22"
        font-weight="700"
        fill="#ff3340"
      >
        ${escapeXML(title)}
      </text>

      ${
        subtitle
          ? `
            <text
              x="${x + w / 2}"
              y="${y + 76}"
              text-anchor="middle"
              direction="rtl"
              font-family="Arial, Tahoma, sans-serif"
              font-size="14"
              fill="#8f8f8f"
            >
              ${escapeXML(subtitle)}
            </text>
          `
          : ''
      }

      <text
        x="${x + w / 2}"
        y="${y + h - 54}"
        text-anchor="middle"
        direction="rtl"
        font-family="Arial, Tahoma, sans-serif"
        font-size="${String(value).length > 24 ? 19 : 25}"
        font-weight="700"
        fill="#f5f5f5"
      >
        ${escapeXML(value)}
      </text>

      <rect
        x="${x + w / 2 - 34}"
        y="${y + h - 20}"
        width="68"
        height="4"
        rx="2"
        fill="#ff2635"
      />

    </g>
  `;

  const smallBox = (
    x,
    y,
    w,
    h,
    title,
    value
  ) => `
    <g>

      <path
        d="
          M ${x + 18} ${y}
          H ${x + w - 18}
          L ${x + w} ${y + 18}
          V ${y + h - 18}
          L ${x + w - 18} ${y + h}
          H ${x + 18}
          L ${x} ${y + h - 18}
          V ${y + 18}
          Z
        "
        fill="#050505"
        stroke="#d7192a"
        stroke-width="1.8"
      />

      <text
        x="${x + w / 2}"
        y="${y + 37}"
        text-anchor="middle"
        direction="rtl"
        font-family="Arial, Tahoma, sans-serif"
        font-size="19"
        font-weight="700"
        fill="#ff3340"
      >
        ${escapeXML(title)}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 87}"
        text-anchor="middle"
        direction="rtl"
        font-family="Arial, Tahoma, sans-serif"
        font-size="${String(value).length > 22 ? 16 : 23}"
        font-weight="700"
        fill="#f2f2f2"
      >
        ${escapeXML(value)}
      </text>

      <rect
        x="${x + w / 2 - 28}"
        y="${y + h - 17}"
        width="56"
        height="4"
        rx="2"
        fill="#ff2635"
      />

    </g>
  `;

  // =========================
  // SVG
  // =========================
  const svg = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
  >

    <defs>

      <linearGradient
        id="bg"
        x1="0"
        y1="0"
        x2="1"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="#030303"
        />

        <stop
          offset="55%"
          stop-color="#120000"
        />

        <stop
          offset="100%"
          stop-color="#020202"
        />
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur
          stdDeviation="5"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <radialGradient id="avatarRing">

        <stop
          offset="70%"
          stop-color="#070707"
        />

        <stop
          offset="72%"
          stop-color="#ff1627"
        />

        <stop
          offset="78%"
          stop-color="#5b0008"
        />

        <stop
          offset="84%"
          stop-color="#ff1627"
        />

        <stop
          offset="100%"
          stop-color="#120000"
        />

      </radialGradient>

    </defs>

    <!-- الخلفية -->

    <rect
      width="1400"
      height="1400"
      rx="45"
      fill="url(#bg)"
    />

    <path
      d="
        M 30 145
        L 95 110
        H 1305
        L 1370 145
        V 1260
        L 1305 1295
        H 95
        L 30 1260
        Z
      "
      fill="none"
      stroke="#6b0008"
      stroke-width="8"
    />

    <path
      d="
        M 45 155
        L 90 130
        H 1310
        L 1355 155
      "
      fill="none"
      stroke="#ff1728"
      stroke-width="3"
      filter="url(#glow)"
    />

    <!-- Header -->

    <text
      x="78"
      y="62"
      font-family="Georgia, serif"
      font-size="48"
      font-weight="700"
      fill="#ff2837"
    >
      ♛ NEON
    </text>

    <text
      x="80"
      y="90"
      font-family="Arial, Tahoma, sans-serif"
      font-size="15"
      letter-spacing="5"
      fill="#aaa"
    >
      DISCORD SERVER
    </text>

    <text
      x="1315"
      y="55"
      text-anchor="end"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="22"
      font-weight="700"
      fill="#ff3340"
    >
      أكثر من مجرد سيرفر
    </text>

    <text
      x="1315"
      y="84"
      text-anchor="end"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="15"
      fill="#aaa"
    >
      نحن عائلة واحدة
    </text>

    <rect
      x="65"
      y="115"
      width="1270"
      height="2"
      fill="#8d000c"
    />

    <rect
      x="95"
      y="113"
      width="1210"
      height="5"
      fill="#ff1d2d"
      opacity="0.8"
      filter="url(#glow)"
    />

    <!-- الجزء العلوي -->

    <rect
      x="65"
      y="155"
      width="1270"
      height="250"
      rx="4"
      fill="#030303"
      stroke="#7e000b"
    />

    <!-- Avatar -->

    <circle
      cx="205"
      cy="285"
      r="157"
      fill="url(#avatarRing)"
    />

    <circle
      cx="205"
      cy="285"
      r="149"
      fill="#050505"
      stroke="#ff1d2d"
      stroke-width="3"
    />

    ${avatarCircle}

    <!-- حالة الأفاتار -->

    <circle
      cx="313"
      cy="390"
      r="26"
      fill="#050505"
      stroke="#ff1728"
      stroke-width="4"
    />

    <circle
      cx="313"
      cy="390"
      r="16"
      fill="${status.color}"
    />

    <!-- الاسم -->

    <text
      x="385"
      y="240"
      direction="ltr"
      font-family="Arial, Tahoma, sans-serif"
      font-size="36"
      font-weight="700"
      fill="#f3f3f3"
    >
      ${safeName}
    </text>

    <text
      x="387"
      y="273"
      direction="ltr"
      font-family="Arial, Tahoma, sans-serif"
      font-size="18"
      fill="#8f8f8f"
    >
      @${safeUsername}
    </text>

    <!-- رقم العضو -->

    <rect
      x="385"
      y="295"
      width="355"
      height="39"
      rx="5"
      fill="#090909"
      stroke="#b60010"
      stroke-width="2"
    />

    <text
      x="405"
      y="321"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="17"
      font-weight="700"
      fill="#ff3340"
    >
      رقم العضو
    </text>

    <text
      x="720"
      y="321"
      text-anchor="end"
      direction="ltr"
      font-family="Arial, Tahoma, sans-serif"
      font-size="19"
      font-weight="700"
      fill="#f4f4f4"
    >
      #${escapeXML(memberNumber)}
    </text>

    <!-- الحالة -->

    <rect
      x="385"
      y="345"
      width="355"
      height="39"
      rx="5"
      fill="#090909"
      stroke="#b60010"
      stroke-width="2"
    />

    <circle
      cx="407"
      cy="364"
      r="7"
      fill="${status.color}"
    />

    <text
      x="425"
      y="371"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="16"
      fill="#aaa"
    >
      حالة العضو
    </text>

    <text
      x="720"
      y="371"
      text-anchor="end"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="18"
      font-weight="700"
      fill="${status.color}"
    >
      ${escapeXML(status.text)}
    </text>

    <!-- ملف العضو -->

    <path
      d="
        M 785 180
        H 1260
        L 1300 220
        V 360
        L 1260 400
        H 785
        L 750 365
        V 215
        Z
      "
      fill="#060606"
      stroke="#ff2635"
      stroke-width="2.5"
    />

    <text
      x="1025"
      y="240"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="32"
      font-weight="700"
      fill="#ff2635"
    >
      ملف العضو
    </text>

    <text
      x="1025"
      y="278"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="17"
      fill="#d0d0d0"
    >
      بطاقة تعريف العضو
    </text>

    <rect
      x="855"
      y="300"
      width="340"
      height="2"
      fill="#ff2635"
    />

    <text
      x="1025"
      y="338"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="15"
      fill="#777"
    >
      بيانات وإحصائيات العضو
    </text>

    <!-- الإحصائيات الرئيسية -->

    ${box(
      65,
      430,
      395,
      190,
      'مدة العضوية',
      membership,
      'مدة وجود العضو داخل السيرفر'
    )}

    ${box(
      500,
      430,
      395,
      190,
      'عدد الرسائل',
      `${messages} رسالة`,
      'إجمالي رسائل العضو'
    )}

    ${box(
      935,
      430,
      395,
      190,
      'وقت المكالمات',
      voice,
      'إجمالي وقت وجود العضو في الفويس'
    )}

    <!-- الصف الثاني -->

    ${smallBox(
      65,
      650,
      290,
      150,
      'حالة العضو',
      status.text
    )}

    ${smallBox(
      375,
      650,
      290,
      150,
      'ترتيب العضو',
      `#${number(memberNumber)}`
    )}

    ${smallBox(
      685,
      650,
      290,
      150,
      'عدد الرتب',
      `${number(roleCount)} رتبة`
    )}

    ${smallBox(
      995,
      650,
      335,
      150,
      'عمر الحساب',
      accountAge
    )}

    <!-- الصف الثالث -->

    ${smallBox(
      65,
      830,
      400,
      150,
      'اسم العضو',
      safeName
    )}

    ${smallBox(
      500,
      830,
      400,
      150,
      'تاريخ الانضمام',
      joinDate
    )}

    ${smallBox(
      935,
      830,
      395,
      150,
      'تاريخ إنشاء الحساب',
      accountDate
    )}

    <!-- الصف الأخير -->

    ${smallBox(
      65,
      1010,
      600,
      150,
      'معرّف العضو',
      safeMemberId
    )}

    ${smallBox(
      700,
      1010,
      630,
      150,
      'اسم المستخدم',
      safeUsername
    )}

    <!-- Footer -->

    <rect
      x="65"
      y="1205"
      width="1270"
      height="2"
      fill="#690009"
    />

    <text
      x="700"
      y="1255"
      text-anchor="middle"
      font-family="Georgia, serif"
      font-size="38"
      font-weight="700"
      fill="#ff2635"
    >
      ♛ NEON
    </text>

    <text
      x="700"
      y="1282"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="14"
      fill="#777"
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

// =========================
// أمر /dna
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة NEON DNA وإحصائيات العضو'
    )
].map(command => command.toJSON());

const rest =
  new REST({
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

// =========================
// Ready
// =========================

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

    for (
      const guild
      of client.guilds.cache.values()
    ) {

      for (
        const member
        of guild.members.cache.values()
      ) {

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
          memberData.voiceStarted =
            null;
        }
      }
    }

    saveDataNow();
  }
);

// =========================
// الرسائل
// =========================

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

    saveDataSoon();
  }
);

// =========================
// الفويس
// =========================

client.on(
  'voiceStateUpdate',
  (oldState, newState) => {

    if (!newState.guild) {
      return;
    }

    if (newState.member?.user?.bot) {
      return;
    }

    const memberData =
      getMemberData(
        newState.guild.id,
        newState.id
      );

    // دخول
    if (
      !oldState.channelId &&
      newState.channelId
    ) {

      memberData.voiceStarted =
        Date.now();

      saveDataSoon();
      return;
    }

    // خروج
    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      if (memberData.voiceStarted) {

        memberData.voiceSeconds +=
          Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                Number(
                  memberData.voiceStarted
                )
              ) / 1000
            )
          );
      }

      memberData.voiceStarted =
        null;

      saveDataSoon();
      return;
    }

    // نقل روم
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
        newState.channelId
    ) {

      if (!memberData.voiceStarted) {
        memberData.voiceStarted =
          Date.now();
      }

      saveDataSoon();
    }
  }
);

// =========================
// /dna
// =========================

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

// =========================
// حفظ البيانات
// =========================

process.on(
  'SIGINT',
  () => {
    saveDataNow();
    process.exit(0);
  }
);

process.on(
  'SIGTERM',
  () => {
    saveDataNow();
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

    saveDataNow();
  }
);

process.on(
  'unhandledRejection',
  error => {
    console.error(
      '❌ unhandledRejection:',
      error
    );
  }
);

// =========================
// Login
// =========================

client.login(TOKEN);
