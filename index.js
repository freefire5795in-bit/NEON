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


// ═══════════════════════════════════════════════════════
// ⚙️ إعدادات NEON
// ═══════════════════════════════════════════════════════

const CLIENT_ID = '1557370938650271824';

const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود في الاستضافة.');
  process.exit(1);
}


// ═══════════════════════════════════════════════════════
// 🤖 البوت
// ═══════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════
// 💾 البيانات
// ═══════════════════════════════════════════════════════

const DATA_FILE = path.join(
  __dirname,
  'data.json'
);

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
    console.error(
      '❌ خطأ حفظ البيانات:',
      error
    );
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


// ═══════════════════════════════════════════════════════
// 🧹 حماية النص
// ═══════════════════════════════════════════════════════

function escapeXML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


// ═══════════════════════════════════════════════════════
// ✂️ اختصار النصوص الطويلة
// ═══════════════════════════════════════════════════════

function shortenText(text, maxLength) {

  text = String(text);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + '...';
}


// ═══════════════════════════════════════════════════════
// 🔠 حجم اسم العضو تلقائيًا
// ═══════════════════════════════════════════════════════

function getUsernameStyle(username) {

  const length = username.length;

  if (length <= 12) {
    return {
      size: 44,
      text: username
    };
  }

  if (length <= 16) {
    return {
      size: 39,
      text: username
    };
  }

  if (length <= 20) {
    return {
      size: 35,
      text: username
    };
  }

  if (length <= 25) {
    return {
      size: 31,
      text: username
    };
  }

  return {
    size: 28,
    text: shortenText(username, 27)
  };
}


// ═══════════════════════════════════════════════════════
// ⏱️ مدة العضوية
// ═══════════════════════════════════════════════════════

function getMembershipTime(joinedAt) {

  if (!joinedAt) {
    return {
      days: 0,
      hours: 0
    };
  }

  const difference =
    Math.max(
      0,
      Date.now() - joinedAt.getTime()
    );

  return {
    days: Math.floor(
      difference / 86400000
    ),

    hours: Math.floor(
      (difference % 86400000) / 3600000
    )
  };
}


// ═══════════════════════════════════════════════════════
// 🎂 عمر الحساب
// ═══════════════════════════════════════════════════════

function getAccountAge(createdAt) {

  if (!createdAt) {
    return {
      number: 0,
      text: 'يوم'
    };
  }

  const days = Math.floor(
    Math.max(
      0,
      Date.now() - createdAt.getTime()
    ) / 86400000
  );

  const years = Math.floor(
    days / 365
  );

  const months = Math.floor(
    (days % 365) / 30
  );

  if (years > 0) {
    return {
      number: years,
      text: years === 1
        ? 'سنة'
        : 'سنوات'
    };
  }

  if (months > 0) {
    return {
      number: months,
      text: months === 1
        ? 'شهر'
        : 'شهور'
    };
  }

  return {
    number: days,
    text: 'يوم'
  };
}


// ═══════════════════════════════════════════════════════
// 🎙️ وقت الفويس
// ═══════════════════════════════════════════════════════

function formatVoiceTime(seconds) {

  seconds = Math.max(
    0,
    Math.floor(seconds)
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
    return `${days} يوم و ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}


// ═══════════════════════════════════════════════════════
// 🟢 حالة العضو
// ═══════════════════════════════════════════════════════

function getMemberStatus(member) {

  const status =
    member.presence?.status;

  if (status === 'online') {
    return {
      text: 'متصل',
      color: '#36e56f',
      icon: '●'
    };
  }

  if (status === 'idle') {
    return {
      text: 'خامل',
      color: '#f0b429',
      icon: '●'
    };
  }

  if (status === 'dnd') {
    return {
      text: 'مشغول',
      color: '#ff4040',
      icon: '●'
    };
  }

  return {
    text: 'غير متصل',
    color: '#777777',
    icon: '●'
  };
}


// ═══════════════════════════════════════════════════════
// 🔢 رقم العضو
// ═══════════════════════════════════════════════════════

async function getMemberNumber(guild, target) {

  try {

    const members =
      await guild.members.fetch();

    // تحويل Collection إلى Array
    const humans = [
      ...members.values()
    ]
      .filter(
        member => !member.user.bot
      )
      .sort(
        (a, b) =>
          (a.joinedTimestamp || Infinity) -
          (b.joinedTimestamp || Infinity)
      );

    const index =
      humans.findIndex(
        member =>
          member.id === target.id
      );

    return index === -1
      ? humans.length
      : index + 1;

  } catch (error) {

    console.error(
      '⚠️ خطأ حساب رقم العضو:',
      error
    );

    return 1;
  }
}


// ═══════════════════════════════════════════════════════
// 🎨 إنشاء بطاقة NEON
// ═══════════════════════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  const WIDTH = 1320;
  const HEIGHT = 1150;


  // ───────────────────────────────────────────────────
  // 👤 البيانات
  // ───────────────────────────────────────────────────

  const rawUsername =
    member.user.username;

  const usernameStyle =
    getUsernameStyle(rawUsername);

  const username =
    escapeXML(usernameStyle.text);

  const tag =
    escapeXML(
      member.user.tag ||
      member.user.username
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

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  const messages =
    Number(
      memberData.messages || 0
    ).toLocaleString('en-US');


  // ───────────────────────────────────────────────────
  // 🎙️ وقت الفويس
  // ───────────────────────────────────────────────────

  let voiceSeconds =
    Number(
      memberData.voiceSeconds || 0
    );

  if (memberData.voiceStarted) {

    voiceSeconds +=
      Math.floor(
        (
          Date.now() -
          memberData.voiceStarted
        ) / 1000
      );
  }

  const voiceTime =
    escapeXML(
      formatVoiceTime(
        voiceSeconds
      )
    );


  // ═══════════════════════════════════════════════════
  // 🖼️ الأفاتار
  // ═══════════════════════════════════════════════════

  let avatarBase64 = '';

  try {

    const avatarURL =
      member.user.displayAvatarURL({
        extension: 'png',
        size: 256
      });

    const response =
      await fetch(avatarURL);

    if (response.ok) {

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      avatarBase64 =
        buffer.toString('base64');
    }

  } catch (error) {

    console.error(
      '⚠️ خطأ تحميل الأفاتار:',
      error.message
    );
  }


  const avatarSVG =
    avatarBase64

      ? `
        <image
          href="data:image/png;base64,${avatarBase64}"
          x="95"
          y="205"
          width="290"
          height="290"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `

      : `
        <circle
          cx="240"
          cy="350"
          r="145"
          fill="#120202"
        />

        <text
          x="240"
          y="370"
          text-anchor="middle"
          fill="#ff1f2d"
          font-size="55"
          font-weight="bold"
        >
          NEON
        </text>
      `;


  // ═══════════════════════════════════════════════════
  // 📦 مربع الإحصائية الكبيرة
  // ═══════════════════════════════════════════════════

  function bigStat(
    x,
    y,
    width,
    title,
    subtitle,
    value,
    icon
  ) {

    return `

      <path
        d="
          M${x + 22} ${y}
          H${x + width - 22}
          L${x + width} ${y + 22}
          V${y + 198}
          L${x + width - 22} ${y + 220}
          H${x + 22}
          L${x} ${y + 198}
          V${y + 22}
          Z
        "
        fill="#090909"
        stroke="#b20d18"
        stroke-width="2.5"
      />

      <path
        d="
          M${x + 30}
          ${y + 205}
          H${x + width - 30}
        "
        stroke="#ff1e2d"
        stroke-width="4"
        stroke-linecap="round"
        opacity=".75"
      />

      <text
        x="${x + width / 2}"
        y="${y + 48}"
        text-anchor="middle"
        fill="#ff2635"
        font-size="27"
        font-weight="bold"
        font-family="DejaVu Sans, Arial"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + width / 2}"
        y="${y + 80}"
        text-anchor="middle"
        fill="#8e8e8e"
        font-size="15"
        font-family="DejaVu Sans, Arial"
      >
        ${subtitle}
      </text>

      <text
        x="${x + width / 2}"
        y="${y + 137}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="26"
        font-weight="bold"
        font-family="DejaVu Sans, Arial"
      >
        ${value}
      </text>

      <text
        x="${x + width / 2}"
        y="${y + 188}"
        text-anchor="middle"
        fill="#454545"
        font-size="12"
        font-family="DejaVu Sans, Arial"
      >
        ✦ يتم التحديث تلقائياً
      </text>

    `;
  }


  // ═══════════════════════════════════════════════════
  // 📦 مربع الإحصائية الصغيرة
  // ═══════════════════════════════════════════════════

  function smallStat(
    x,
    y,
    width,
    title,
    value,
    icon
  ) {

    return `

      <path
        d="
          M${x + 15} ${y}
          H${x + width - 15}
          L${x + width} ${y + 15}
          V${y + 160}
          L${x + width - 15} ${y + 175}
          H${x + 15}
          L${x} ${y + 160}
          V${y + 15}
          Z
        "
        fill="#080808"
        stroke="#8f0d17"
        stroke-width="2"
      />

      <text
        x="${x + width / 2}"
        y="${y + 42}"
        text-anchor="middle"
        fill="#ff2937"
        font-size="21"
        font-weight="bold"
        font-family="DejaVu Sans, Arial"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + width / 2}"
        y="${y + 98}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="24"
        font-weight="bold"
        font-family="DejaVu Sans, Arial"
      >
        ${value}
      </text>

      <rect
        x="${x + width / 2 - 28}"
        y="${y + 140}"
        width="56"
        height="4"
        rx="2"
        fill="#ff1f2d"
      />

    `;
  }


  // ═══════════════════════════════════════════════════
  // 🎨 SVG
  // ═══════════════════════════════════════════════════

  const svg = `

  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${WIDTH}"
    height="${HEIGHT}"
    viewBox="0 0 ${WIDTH} ${HEIGHT}"
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
          offset="45%"
          stop-color="#100202"
        />

        <stop
          offset="100%"
          stop-color="#030303"
        />

      </linearGradient>


      <!-- الأحمر -->
      <linearGradient
        id="redGradient"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >

        <stop
          offset="0%"
          stop-color="#5c0008"
        />

        <stop
          offset="50%"
          stop-color="#ff1c2d"
        />

        <stop
          offset="100%"
          stop-color="#5c0008"
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


      <!-- قص الأفاتار -->
      <clipPath id="avatarClip">

        <circle
          cx="240"
          cy="350"
          r="145"
        />

      </clipPath>

    </defs>


    <!-- ═════════════════════════════════════════════ -->
    <!-- الخلفية -->
    <!-- ═════════════════════════════════════════════ -->

    <rect
      width="1320"
      height="1150"
      rx="42"
      fill="url(#background)"
    />


    <!-- إضاءة -->
    <circle
      cx="1150"
      cy="90"
      r="300"
      fill="#ff0000"
      opacity=".035"
    />

    <circle
      cx="80"
      cy="1060"
      r="260"
      fill="#ff0000"
      opacity=".03"
    />


    <!-- ═════════════════════════════════════════════ -->
    <!-- الإطار الخارجي -->
    <!-- ═════════════════════════════════════════════ -->

    <path
      d="
        M30 145
        L92 120
        H1228
        L1290 145
        V1000
        L1228 1030
        H92
        L30 1000
        Z
      "
      fill="none"
      stroke="#57070b"
      stroke-width="9"
    />

    <path
      d="
        M30 145
        L92 120
        H1228
        L1290 145
        V1000
        L1228 1030
        H92
        L30 1000
        Z
      "
      fill="none"
      stroke="url(#redGradient)"
      stroke-width="3"
      filter="url(#glow)"
    />


    <!-- الإطار الداخلي -->

    <rect
      x="52"
      y="160"
      width="1216"
      height="830"
      rx="3"
      fill="none"
      stroke="#56070c"
      stroke-width="1.5"
    />


    <!-- ═════════════════════════════════════════════ -->
    <!-- رأس البطاقة -->
    <!-- ═════════════════════════════════════════════ -->

    <text
      x="82"
      y="64"
      fill="#ff2635"
      font-size="48"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ♛ NEON
    </text>

    <text
      x="84"
      y="96"
      fill="#bcbcbc"
      font-size="19"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      سـيـرفـر ديسكورد
    </text>


    <text
      x="1050"
      y="58"
      text-anchor="middle"
      fill="#ff2635"
      font-size="21"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      أكـثـر مـن مـجـرد سـيـرفـر
    </text>

    <text
      x="1050"
      y="89"
      text-anchor="middle"
      fill="#999999"
      font-size="18"
      font-family="DejaVu Sans, Arial"
    >
      نـحـن عـائـلـة واحـدة ✦
    </text>


    <path
      d="M70 123 H1250"
      stroke="url(#redGradient)"
      stroke-width="3"
      filter="url(#glow)"
    />


    <!-- ═════════════════════════════════════════════ -->
    <!-- قسم العضو -->
    <!-- ═════════════════════════════════════════════ -->


    <!-- إطار الأفاتار -->

    <circle
      cx="240"
      cy="350"
      r="174"
      fill="#050505"
      stroke="#410006"
      stroke-width="10"
    />

    <circle
      cx="240"
      cy="350"
      r="163"
      fill="none"
      stroke="#8e0c14"
      stroke-width="5"
    />

    <circle
      cx="240"
      cy="350"
      r="153"
      fill="none"
      stroke="#ff1828"
      stroke-width="5"
      filter="url(#glow)"
    />

    ${avatarSVG}


    <!-- حالة العضو -->

    <circle
      cx="360"
      cy="468"
      r="29"
      fill="#050505"
      stroke="#ff1d2c"
      stroke-width="4"
    />

    <circle
      cx="360"
      cy="468"
      r="15"
      fill="${status.color}"
      filter="url(#glow)"
    />


    <!-- ═════════════════════════════════════════════ -->
    <!-- معلومات العضو -->
    <!-- ═════════════════════════════════════════════ -->

    <!-- منطقة الاسم ثابتة -->
    <rect
      x="455"
      y="205"
      width="345"
      height="82"
      rx="10"
      fill="#070707"
      opacity=".65"
    />

    <text
      x="627"
      y="254"
      text-anchor="middle"
      fill="#ffffff"
      font-size="${usernameStyle.size}"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ${username}
    </text>


    <text
      x="627"
      y="284"
      text-anchor="middle"
      fill="#858585"
      font-size="17"
      font-family="DejaVu Sans, Arial"
    >
      ${tag}
    </text>


    <!-- خط فاصل -->

    <path
      d="M455 307 H800"
      stroke="#3b080c"
      stroke-width="2"
    />


    <!-- رقم العضو -->

    <path
      d="
        M455 327
        H775
        L800 350
        L775 373
        H455
        Z
      "
      fill="#090909"
      stroke="#970d17"
      stroke-width="2"
    />

    <text
      x="490"
      y="356"
      fill="#ff2635"
      font-size="19"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ♛ رقم العضو
    </text>

    <text
      x="765"
      y="358"
      text-anchor="end"
      fill="#ffffff"
      font-size="27"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      #${memberNumber}
    </text>


    <!-- الحالة -->

    <path
      d="
        M455 390
        H775
        L800 413
        L775 436
        H455
        Z
      "
      fill="#090909"
      stroke="#970d17"
      stroke-width="2"
    />

    <circle
      cx="490"
      cy="413"
      r="8"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="515"
      y="420"
      fill="#9b9b9b"
      font-size="18"
      font-family="DejaVu Sans, Arial"
    >
      حالة العضو
    </text>

    <text
      x="755"
      y="420"
      text-anchor="end"
      fill="${status.color}"
      font-size="21"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ${status.text}
    </text>


    <!-- ═════════════════════════════════════════════ -->
    <!-- بطاقة الملف -->
    <!-- ═════════════════════════════════════════════ -->

    <path
      d="
        M865 205
        H1178
        L1210 237
        V402
        L1178 434
        H865
        L840 409
        V230
        Z
      "
      fill="#080808"
      stroke="#ff1d2c"
      stroke-width="3"
    />


    <path
      d="
        M880 220
        H1165
        L1194 249
        V390
        L1165 419
        H880
        L856 395
        V244
        Z
      "
      fill="none"
      stroke="#3b070b"
      stroke-width="1"
    />


    <text
      x="1025"
      y="282"
      text-anchor="middle"
      fill="#ff2635"
      font-size="34"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ملف العضو
    </text>


    <text
      x="1025"
      y="322"
      text-anchor="middle"
      fill="#d0d0d0"
      font-size="21"
      font-family="DejaVu Sans, Arial"
    >
      بطاقة تعريف العضو
    </text>


    <path
      d="M925 350 H1125"
      stroke="url(#redGradient)"
      stroke-width="3"
    />


    <text
      x="1025"
      y="386"
      text-anchor="middle"
      fill="#707070"
      font-size="15"
      font-family="DejaVu Sans, Arial"
    >
      ✦ معلومات وإحصائيات العضو ✦
    </text>


    <!-- ═════════════════════════════════════════════ -->
    <!-- الإحصائيات -->
    <!-- ═════════════════════════════════════════════ -->


    ${bigStat(
      55,
      535,
      385,
      'مدة العضوية',
      'مدة وجود العضو في السيرفر',
      `${membership.days} يوم و ${membership.hours} ساعة`,
      '▦'
    )}


    ${bigStat(
      467,
      535,
      385,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${messages} رسالة`,
      '☏'
    )}


    ${bigStat(
      879,
      535,
      385,
      'وقت المكالمات',
      'إجمالي وقت التواجد في الفويس',
      voiceTime,
      '♫'
    )}


    <!-- ═════════════════════════════════════════════ -->
    <!-- الإحصائيات السفلية -->
    <!-- ═════════════════════════════════════════════ -->


    ${smallStat(
      55,
      785,
      285,
      'عمر الحساب',
      `${accountAge.number} ${accountAge.text}`,
      '●'
    )}


    ${smallStat(
      365,
      785,
      285,
      'عدد الرتب',
      `${roleCount} رتبة`,
      '◇'
    )}


    ${smallStat(
      675,
      785,
      285,
      'ترتيب العضو',
      `#${memberNumber}`,
      '♙'
    )}


    ${smallStat(
      985,
      785,
      279,
      'حالة العضو',
      status.text,
      '♥'
    )}


    <!-- ═════════════════════════════════════════════ -->
    <!-- الخط السفلي -->
    <!-- ═════════════════════════════════════════════ -->

    <path
      d="M55 985 H1265"
      stroke="url(#redGradient)"
      stroke-width="3"
      filter="url(#glow)"
    />


    <!-- ═════════════════════════════════════════════ -->
    <!-- الفوتر -->
    <!-- ═════════════════════════════════════════════ -->

    <text
      x="660"
      y="1038"
      text-anchor="middle"
      fill="#ff2635"
      font-size="43"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      ♛ NEON
    </text>


    <text
      x="660"
      y="1070"
      text-anchor="middle"
      fill="#a9a9a9"
      font-size="18"
      font-weight="bold"
      font-family="DejaVu Sans, Arial"
    >
      سـيـرفـر ديسكورد
    </text>


    <text
      x="660"
      y="1100"
      text-anchor="middle"
      fill="#555555"
      font-size="14"
      font-family="DejaVu Sans, Arial"
    >
      ✦ يتم تحديث بيانات البطاقة تلقائياً ✦
    </text>

  </svg>
  `;


  // ═══════════════════════════════════════════════════
  // 🖼️ تحويل SVG إلى PNG
  // ═══════════════════════════════════════════════════

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}


// ═══════════════════════════════════════════════════════
// 📜 أمر /dna
// ═══════════════════════════════════════════════════════

const commands = [

  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة العضو وإحصائياته'
    )

].map(
  command => command.toJSON()
);


// ═══════════════════════════════════════════════════════
// 🔄 تسجيل الأمر
// ═══════════════════════════════════════════════════════

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
      '✅ تم تسجيل /dna بنجاح.'
    );

  } catch (error) {

    console.error(
      '❌ خطأ تسجيل الأمر:',
      error
    );
  }
}


// ═══════════════════════════════════════════════════════
// 🟢 البوت جاهز
// ═══════════════════════════════════════════════════════

client.once(
  'ready',
  async () => {

    console.log(
      `✅ تم تشغيل البوت: ${client.user.tag}`
    );

    console.log(
      `📌 قناة DNA: ${DNA_CHANNEL_ID}`
    );

    await registerCommands();
  }
);


// ═══════════════════════════════════════════════════════
// 💬 تسجيل الرسائل
// ═══════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════
// 🎙️ تسجيل الفويس
// ═══════════════════════════════════════════════════════

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


    // دخول فويس
    if (
      !oldState.channel &&
      newState.channel
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }


    // خروج من فويس
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

      memberData.voiceStarted =
        null;

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

      if (
        !memberData.voiceStarted
      ) {

        memberData.voiceStarted =
          Date.now();

        saveData();
      }
    }
  }
);


// ═══════════════════════════════════════════════════════
// 🧬 أمر DNA
// ═══════════════════════════════════════════════════════

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


    // قناة DNA فقط
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


      // جلب العضو
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


      // رقم العضو
      const memberNumber =
        await getMemberNumber(
          interaction.guild,
          member
        );


      // إنشاء البطاقة
      const image =
        await createDNAImage(
          member,
          memberData,
          memberNumber
        );


      // إرسال الصورة
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
        '❌ خطأ في إنشاء بطاقة DNA:',
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


// ═══════════════════════════════════════════════════════
// 💾 حفظ البيانات قبل إغلاق البوت
// ═══════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════
// 🔐 تشغيل البوت
// ═══════════════════════════════════════════════════════

client.login(TOKEN);
