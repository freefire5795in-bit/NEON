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
// ⚙️ إعدادات البوت
// ═══════════════════════════════════════

const CLIENT_ID = '1557370938650271824';

const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ متغير DISCORD_TOKEN غير موجود.');
  process.exit(1);
}


// ═══════════════════════════════════════
// 🤖 تشغيل البوت
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
// 💾 ملف البيانات
// ═══════════════════════════════════════

const DATA_FILE = path.join(
  __dirname,
  'data.json'
);

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );
  } catch {
    data = {};
  }
}


function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      'utf8'
    );
  } catch (error) {
    console.error(
      '❌ خطأ في حفظ البيانات:',
      error
    );
  }
}


function getMemberData(
  guildId,
  userId
) {
  data[guildId] ??= {};

  data[guildId][userId] ??= {
    messages: 0,
    voiceSeconds: 0,
    voiceStarted: null
  };

  return data[guildId][userId];
}


// ═══════════════════════════════════════
// 🧹 حماية النصوص
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
// ⏱️ مدة العضوية
// ═══════════════════════════════════════

function getMembershipTime(joinedAt) {

  if (!joinedAt) {
    return {
      days: 0,
      hours: 0
    };
  }

  const difference = Math.max(
    0,
    Date.now() - joinedAt.getTime()
  );

  const days = Math.floor(
    difference / 86400000
  );

  const hours = Math.floor(
    (difference % 86400000) /
    3600000
  );

  return {
    days,
    hours
  };
}


// ═══════════════════════════════════════
// 🎂 عمر الحساب
// ═══════════════════════════════════════

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
      Date.now() -
      createdAt.getTime()
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
      text:
        years === 1
          ? 'سنة'
          : 'سنوات'
    };
  }

  if (months > 0) {
    return {
      number: months,
      text:
        months === 1
          ? 'شهر'
          : 'شهور'
    };
  }

  return {
    number: days,
    text: 'يوم'
  };
}


// ═══════════════════════════════════════
// 🎙️ وقت الفويس
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
    return `${days} يوم و ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}


// ═══════════════════════════════════════
// 🟢 حالة العضو
// ═══════════════════════════════════════

function getMemberStatus(member) {

  const status =
    member.presence?.status;

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
// 🔢 رقم العضو
// ═══════════════════════════════════════

async function getMemberNumber(
  guild,
  target
) {

  try {

    const members =
      await guild.members.fetch();

    // تحويل Collection إلى Array
    // حتى يعمل findIndex بدون مشكلة
    const humans = [
      ...members.values()
    ]
      .filter(
        member =>
          !member.user.bot
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

    if (index === -1) {
      return humans.length;
    }

    return index + 1;

  } catch (error) {

    console.error(
      '⚠️ تعذر حساب رقم العضو:',
      error
    );

    return 1;
  }
}


// ═══════════════════════════════════════
// 🎨 إنشاء بطاقة NEON
// ═══════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  const width = 1320;
  const height = 1150;


  // ───────────────────────────────────
  // 👤 معلومات العضو
  // ───────────────────────────────────

  const username =
    escapeXML(
      member.user.username
    );

  const tag =
    escapeXML(
      member.user.tag ||
      member.user.username
    );


  // ───────────────────────────────────
  // 🟢 الحالة
  // ───────────────────────────────────

  const status =
    getMemberStatus(member);


  // ───────────────────────────────────
  // ⏱️ مدة العضوية
  // ───────────────────────────────────

  const membership =
    getMembershipTime(
      member.joinedAt
    );


  // ───────────────────────────────────
  // 🎂 عمر الحساب
  // ───────────────────────────────────

  const accountAge =
    getAccountAge(
      member.user.createdAt
    );


  // ───────────────────────────────────
  // 🏷️ عدد الرتب
  // ───────────────────────────────────

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );


  // ───────────────────────────────────
  // 💬 الرسائل
  // ───────────────────────────────────

  const messages =
    Number(
      memberData.messages || 0
    ).toLocaleString('en-US');


  // ───────────────────────────────────
  // 🎙️ الفويس
  // ───────────────────────────────────

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


  // ═══════════════════════════════════
  // 🖼️ تحميل صورة العضو
  // ═══════════════════════════════════

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

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      avatar =
        buffer.toString('base64');
    }

  } catch (error) {

    console.error(
      '⚠️ تعذر تحميل صورة العضو:',
      error.message
    );
  }


  // ═══════════════════════════════════
  // 👤 صورة الأفاتار
  // ═══════════════════════════════════

  const avatarSVG = avatar

    ? `
      <image
        href="data:image/png;base64,${avatar}"
        x="95"
        y="200"
        width="300"
        height="300"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `

    : `
      <circle
        cx="245"
        cy="350"
        r="150"
        fill="#180505"
      />

      <text
        x="245"
        y="370"
        text-anchor="middle"
        fill="#ff2525"
        font-size="60"
        font-weight="bold"
      >
        NEON
      </text>
    `;


  // ═══════════════════════════════════
  // 📦 المربعات الكبيرة
  // ═══════════════════════════════════

  function bigBox(
    x,
    y,
    w,
    title,
    subtitle,
    value,
    icon
  ) {

    return `

      <path
        d="
          M${x + 25} ${y}
          H${x + w - 25}
          L${x + w} ${y + 25}
          V${y + 195}
          L${x + w - 25} ${y + 220}
          H${x + 25}
          L${x} ${y + 195}
          V${y + 25}
          Z
        "
        fill="#080808"
        stroke="#a50913"
        stroke-width="3"
      />

      <path
        d="
          M${x + 35}
          ${y + 207}
          H${x + w * 0.48}
        "
        stroke="#ff202d"
        stroke-width="6"
        stroke-linecap="round"
      />

      <text
        x="${x + w / 2}"
        y="${y + 50}"
        fill="#ff3038"
        font-size="27"
        font-weight="bold"
        text-anchor="middle"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 82}"
        fill="#9a9a9a"
        font-size="17"
        text-anchor="middle"
      >
        ${subtitle}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 137}"
        fill="#ffffff"
        font-size="27"
        font-weight="bold"
        text-anchor="middle"
      >
        ${value}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 193}"
        fill="#555555"
        font-size="13"
        text-anchor="middle"
      >
        يتم تحديث البيانات تلقائياً
      </text>

    `;
  }


  // ═══════════════════════════════════
  // 📦 المربعات الصغيرة
  // ═══════════════════════════════════

  function smallBox(
    x,
    y,
    w,
    title,
    value,
    icon
  ) {

    return `

      <path
        d="
          M${x + 17} ${y}
          H${x + w - 17}
          L${x + w} ${y + 17}
          V${y + 160}
          L${x + w - 17} ${y + 177}
          H${x + 17}
          L${x} ${y + 160}
          V${y + 17}
          Z
        "
        fill="#070707"
        stroke="#8d1017"
        stroke-width="2"
      />

      <text
        x="${x + w / 2}"
        y="${y + 42}"
        text-anchor="middle"
        fill="#ff3038"
        font-size="22"
        font-weight="bold"
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 96}"
        text-anchor="middle"
        fill="#ffffff"
        font-size="24"
        font-weight="bold"
      >
        ${value}
      </text>

      <path
        d="
          M${x + w / 2 - 25}
          ${y + 145}
          H${x + w / 2 + 25}
        "
        stroke="#ff202d"
        stroke-width="4"
        stroke-linecap="round"
      />

    `;
  }


  // ═══════════════════════════════════
  // 🎨 التصميم الكامل
  // ═══════════════════════════════════

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
          stop-color="#160202"
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
          stop-color="#480000"
        />

        <stop
          offset="50%"
          stop-color="#ff2025"
        />

        <stop
          offset="100%"
          stop-color="#480000"
        />

      </linearGradient>


      <filter id="glow">

        <feGaussianBlur
          stdDeviation="5"
          result="blur"
        />

        <feMerge>

          <feMergeNode
            in="blur"
          />

          <feMergeNode
            in="SourceGraphic"
          />

        </feMerge>

      </filter>


      <clipPath id="avatarClip">

        <circle
          cx="245"
          cy="350"
          r="150"
        />

      </clipPath>

    </defs>


    <!-- الخلفية -->

    <rect
      width="1320"
      height="1150"
      rx="40"
      fill="url(#background)"
    />


    <!-- إضاءة حمراء -->

    <circle
      cx="1160"
      cy="120"
      r="260"
      fill="#ff0000"
      opacity=".055"
    />

    <circle
      cx="100"
      cy="1050"
      r="240"
      fill="#ff0000"
      opacity=".045"
    />


    <!-- الإطار -->

    <path
      d="
        M28 145
        L90 120
        H1230
        L1292 145
        V1005
        L1230 1035
        H90
        L28 1005
        Z
      "
      fill="none"
      stroke="url(#redLine)"
      stroke-width="5"
      filter="url(#glow)"
    />


    <path
      d="
        M50 160
        H1270
        V990
        H50
        Z
      "
      fill="none"
      stroke="#61070b"
      stroke-width="2"
    />


    <!-- اسم السيرفر -->

    <text
      x="80"
      y="66"
      fill="#ff2525"
      font-size="50"
      font-weight="bold"
    >
      ♛ NEON
    </text>

    <text
      x="82"
      y="98"
      fill="#cfcfcf"
      font-size="20"
      font-weight="bold"
    >
      سـيـرفـر ديسكورد
    </text>


    <text
      x="950"
      y="56"
      fill="#ff2525"
      font-size="20"
      text-anchor="middle"
      font-weight="bold"
    >
      أكـثـر مـن مـجـرد سـيـرفـر
    </text>

    <text
      x="950"
      y="87"
      fill="#aaaaaa"
      font-size="19"
      text-anchor="middle"
    >
      نـحـن عـائـلـة واحـدة
    </text>


    <path
      d="M70 125H1250"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />


    <!-- صورة العضو -->

    <circle
      cx="245"
      cy="350"
      r="175"
      fill="#050505"
      stroke="#4e0004"
      stroke-width="10"
    />

    <circle
      cx="245"
      cy="350"
      r="162"
      fill="none"
      stroke="#ff151c"
      stroke-width="7"
      filter="url(#glow)"
    />

    <circle
      cx="245"
      cy="350"
      r="154"
      fill="none"
      stroke="#8c0a10"
      stroke-width="2"
    />

    ${avatarSVG}


    <!-- حالة العضو -->

    <circle
      cx="365"
      cy="470"
      r="27"
      fill="#050505"
      stroke="#ff2025"
      stroke-width="4"
    />

    <circle
      cx="365"
      cy="470"
      r="16"
      fill="${status.color}"
      filter="url(#glow)"
    />


    <!-- اسم العضو -->

    <text
      x="455"
      y="270"
      fill="#ffffff"
      font-size="43"
      font-weight="bold"
    >
      ${username}
    </text>


    <text
      x="455"
      y="305"
      fill="#999999"
      font-size="21"
    >
      ${tag}
    </text>


    <!-- رقم العضو -->

    <path
      d="
        M455 330
        H805
        L825 350
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <text
      x="485"
      y="362"
      fill="#ff252d"
      font-size="20"
      font-weight="bold"
    >
      ♛ رقم العضو
    </text>

    <text
      x="785"
      y="362"
      fill="#ffffff"
      font-size="29"
      font-weight="bold"
      text-anchor="end"
    >
      #${memberNumber}
    </text>


    <!-- حالة العضو -->

    <path
      d="
        M455 385
        H805
        L825 405
        H455
        Z
      "
      fill="#0d0505"
      stroke="#8f0b12"
      stroke-width="2"
    />

    <circle
      cx="485"
      cy="420"
      r="9"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="510"
      y="427"
      fill="#999999"
      font-size="19"
    >
      حالة العضو
    </text>

    <text
      x="650"
      y="427"
      fill="${status.color}"
      font-size="22"
      font-weight="bold"
    >
      ${escapeXML(status.text)}
    </text>


    <!-- ملف العضو -->

    <path
      d="
        M875 200
        H1190
        L1220 230
        V405
        L1190 435
        H875
        L850 410
        V225
        Z
      "
      fill="#080606"
      stroke="#ff2025"
      stroke-width="3"
    />

    <text
      x="1035"
      y="292"
      text-anchor="middle"
      fill="#ff3038"
      font-size="35"
      font-weight="bold"
    >
      ملف العضو
    </text>

    <text
      x="1035"
      y="333"
      text-anchor="middle"
      fill="#cccccc"
      font-size="23"
    >
      بطاقة تعريف العضو
    </text>

    <path
      d="M920 365H1150"
      stroke="url(#redLine)"
      stroke-width="4"
    />

    <text
      x="1035"
      y="398"
      text-anchor="middle"
      fill="#777777"
      font-size="18"
    >
      معلومات العضو وإحصائياته
    </text>


    <!-- الإحصائيات الرئيسية -->

    ${bigBox(
      55,
      535,
      385,
      'مدة العضوية',
      'مدة وجود العضو في السيرفر',
      `${membership.days} يوم و ${membership.hours} ساعة`,
      '▦'
    )}


    ${bigBox(
      467,
      535,
      385,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${messages} رسالة`,
      '☏'
    )}


    ${bigBox(
      879,
      535,
      385,
      'وقت المكالمات',
      'إجمالي وقت التواجد في الفويس',
      voiceTime,
      '♫'
    )}


    <!-- الإحصائيات الإضافية -->

    ${smallBox(
      55,
      785,
      285,
      'عمر الحساب',
      `${accountAge.number} ${accountAge.text}`,
      '●'
    )}


    ${smallBox(
      365,
      785,
      285,
      'عدد الرتب',
      `${roleCount} رتبة`,
      '♢'
    )}


    ${smallBox(
      675,
      785,
      285,
      'ترتيب العضو',
      `#${memberNumber}`,
      '♙'
    )}


    ${smallBox(
      985,
      785,
      279,
      'حالة العضو',
      escapeXML(status.text),
      '♥'
    )}


    <!-- الخط السفلي -->

    <path
      d="M55 985H1265"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />


    <!-- النهاية -->

    <text
      x="660"
      y="1042"
      text-anchor="middle"
      fill="#ff2525"
      font-size="45"
      font-weight="bold"
    >
      ♛ NEON
    </text>

    <text
      x="660"
      y="1075"
      text-anchor="middle"
      fill="#aaaaaa"
      font-size="20"
      font-weight="bold"
    >
      سـيـرفـر ديسكورد
    </text>

    <text
      x="660"
      y="1110"
      text-anchor="middle"
      fill="#666666"
      font-size="16"
    >
      يتم تحديث بيانات البطاقة تلقائياً
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
// 📜 أمر /dna
// ═══════════════════════════════════════

const commands = [

  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة تعريف العضو وإحصائياته'
    )

].map(
  command =>
    command.toJSON()
);


// ═══════════════════════════════════════
// 🔄 تسجيل الأمر
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
      '❌ خطأ أثناء تسجيل الأمر:',
      error
    );
  }
}


// ═══════════════════════════════════════
// 🤖 البوت جاهز
// ═══════════════════════════════════════

client.once(
  'ready',
  async () => {

    console.log(
      `✅ تم تشغيل البوت: ${client.user.tag}`
    );

    console.log(
      `📌 قناة بطاقات الأعضاء: ${DNA_CHANNEL_ID}`
    );

    await registerCommands();
  }
);


// ═══════════════════════════════════════
// 💬 تسجيل الرسائل
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
// 🎙️ تسجيل وقت الفويس
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


    // الانتقال بين الرومات

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


// ═══════════════════════════════════════
// 🧬 أمر DNA
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


    // ─────────────────────────────────
    // 📌 قناة DNA فقط
    // ─────────────────────────────────

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


      // إرسال البطاقة

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


// ═══════════════════════════════════════
// 💾 حفظ البيانات عند إغلاق البوت
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
// 🔐 تسجيل الدخول
// ═══════════════════════════════════════

client.login(TOKEN);
