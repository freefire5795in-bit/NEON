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
// NEON CONFIG
// =========================

const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود في الاستضافة.');
  process.exit(1);
}

// =========================
// DISCORD CLIENT
// =========================

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
// DATA
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

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('❌ خطأ حفظ البيانات:', error);
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

// =========================
// HELPERS
// =========================

function escapeXML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =========================
// مدة العضوية
// مثال:
// 16 يوم و 16 ساعة
// =========================

function getMembershipTime(joinedAt) {
  if (!joinedAt) {
    return {
      days: 0,
      hours: 0,
      text: '0 يوم و 0 ساعة'
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
    (difference % 86400000) / 3600000
  );

  return {
    days,
    hours,
    text: `${days} يوم و ${hours} ساعة`
  };
}

// =========================
// عمر حساب Discord
// =========================

function getAccountAge(createdAt) {
  if (!createdAt) {
    return 'غير معروف';
  }

  const difference = Math.max(
    0,
    Date.now() - createdAt.getTime()
  );

  const days = Math.floor(
    difference / 86400000
  );

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);

  if (years > 0) {
    return `${years} سنة`;
  }

  if (months > 0) {
    return `${months} شهر`;
  }

  return `${days} يوم`;
}

// =========================
// وقت الفويس
// =========================

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
      error
    );

    return 1;
  }
}

// =========================
// الاسم لو طويل
// =========================

function getUsernameStyle(username) {
  const length = username.length;

  if (length <= 12) {
    return {
      size: 43,
      y: 270
    };
  }

  if (length <= 18) {
    return {
      size: 36,
      y: 270
    };
  }

  if (length <= 24) {
    return {
      size: 31,
      y: 270
    };
  }

  return {
    size: 27,
    y: 270
  };
}

// =========================
// التاريخ
// =========================

function formatDate(date) {
  if (!date) return 'غير معروف';

  return date.toLocaleDateString(
    'ar-EG',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  );
}

// =========================
// إنشاء بطاقة DNA
// =========================

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const width = 1400;
  const height = 1450;

  const rawUsername =
    member.user.username;

  const username =
    escapeXML(rawUsername);

  const tag =
    escapeXML(
      member.user.tag ||
      member.user.username
    );

  const nickname =
    escapeXML(
      member.nickname ||
      member.user.globalName ||
      member.user.username
    );

  const status =
    getMemberStatus(member);

  const membership =
    getMembershipTime(member.joinedAt);

  const accountAge =
    getAccountAge(
      member.user.createdAt
    );

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  const memberDataMessages =
    Number(memberData.messages || 0);

  const messages =
    memberDataMessages.toLocaleString(
      'en-US'
    );

  const voiceSeconds =
    Math.max(
      0,
      Number(
        memberData.voiceSeconds || 0
      ) +
      (
        memberData.voiceStarted
          ? Math.floor(
              (Date.now() -
                memberData.voiceStarted) /
              1000
            )
          : 0
      )
    );

  const voiceTime =
    escapeXML(
      formatVoiceTime(
        voiceSeconds
      )
    );

  const joinDate =
    formatDate(member.joinedAt);

  const accountDate =
    formatDate(
      member.user.createdAt
    );

  const usernameStyle =
    getUsernameStyle(
      rawUsername
    );

  // =========================
  // Avatar
  // =========================

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
      '⚠️ تعذر تحميل الأفاتار:',
      error.message
    );
  }

  const avatarSvg =
    avatar
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
          font-size="65"
          font-weight="bold"
        >
          NEON
        </text>
      `;

  // =========================
  // خانات كبيرة
  // =========================

  const bigBox = (
    x,
    y,
    w,
    title,
    sub,
    value,
    icon
  ) => `
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

    <text
      x="${x + w / 2}"
      y="${y + 50}"
      fill="#ff3038"
      font-size="28"
      font-weight="bold"
      text-anchor="middle"
    >
      ${icon} ${title}
    </text>

    <text
      x="${x + w / 2}"
      y="${y + 82}"
      fill="#999"
      font-size="17"
      text-anchor="middle"
    >
      ${sub}
    </text>

    <text
      x="${x + w / 2}"
      y="${y + 137}"
      fill="#fff"
      font-size="28"
      font-weight="bold"
      text-anchor="middle"
    >
      ${value}
    </text>

    <path
      d="M${x + 35} ${y + 207}
         H${x + w * 0.48}"
      stroke="#ff202d"
      stroke-width="6"
      stroke-linecap="round"
    />
  `;

  // =========================
  // خانات صغيرة
  // =========================

  const smallBox = (
    x,
    y,
    w,
    title,
    value,
    icon
  ) => `
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
      fill="#fff"
      font-size="22"
      font-weight="bold"
    >
      ${value}
    </text>

    <path
      d="
        M${x + w / 2 - 25} ${y + 145}
        H${x + w / 2 + 25}
      "
      stroke="#ff202d"
      stroke-width="4"
      stroke-linecap="round"
    />
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
        id="red"
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
          result="b"
        />

        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
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

    <!-- BACKGROUND -->

    <rect
      width="${width}"
      height="${height}"
      rx="40"
      fill="url(#bg)"
    />

    <circle
      cx="1250"
      cy="150"
      r="300"
      fill="#f00"
      opacity=".055"
    />

    <circle
      cx="100"
      cy="1300"
      r="260"
      fill="#f00"
      opacity=".045"
    />

    <!-- OUTER FRAME -->

    <path
      d="
        M28 145
        L90 120
        H1310
        L1372 145
        V1305
        L1310 1335
        H90
        L28 1305
        Z
      "
      fill="none"
      stroke="url(#red)"
      stroke-width="5"
      filter="url(#glow)"
    />

    <path
      d="M50 160H1350V1290H50Z"
      fill="none"
      stroke="#61070b"
      stroke-width="2"
    />

    <!-- HEADER -->

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
      font-size="15"
      letter-spacing="5"
    >
      DISCORD SERVER
    </text>

    <text
      x="1080"
      y="56"
      fill="#ff2525"
      font-size="18"
      text-anchor="middle"
      font-weight="bold"
    >
      MORE THAN JUST A SERVER
    </text>

    <text
      x="1080"
      y="87"
      fill="#aaa"
      font-size="19"
      text-anchor="middle"
    >
      WE ARE A FAMILY
    </text>

    <path
      d="M70 125H1330"
      stroke="url(#red)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <!-- AVATAR -->

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

    ${avatarSvg}

    <!-- STATUS DOT -->

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

    <!-- USERNAME -->

    <text
      x="455"
      y="${usernameStyle.y}"
      fill="#fff"
      font-size="${usernameStyle.size}"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="455"
      y="305"
      fill="#999"
      font-size="21"
    >
      @${tag}
    </text>

    <!-- MEMBER NUMBER -->

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
      fill="#fff"
      font-size="29"
      font-weight="bold"
      text-anchor="end"
    >
      #${memberNumber}
    </text>

    <!-- STATUS -->

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
      fill="#999"
      font-size="19"
    >
      الحالة
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

    <!-- PROFILE -->

    <path
      d="
        M875 200
        H1260
        L1290 230
        V405
        L1260 435
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
      x="1070"
      y="292"
      text-anchor="middle"
      fill="#ff3038"
      font-size="35"
      font-weight="bold"
    >
      ملف العضو
    </text>

    <text
      x="1070"
      y="333"
      text-anchor="middle"
      fill="#ccc"
      font-size="23"
    >
      بطاقة تعريف العضو
    </text>

    <path
      d="M940 365H1200"
      stroke="url(#red)"
      stroke-width="4"
    />

    <text
      x="1070"
      y="398"
      text-anchor="middle"
      fill="#777"
      font-size="16"
    >
      NEON MEMBER PROFILE
    </text>

    <!-- MAIN STATS -->

    ${bigBox(
      55,
      535,
      405,
      'مدة العضوية',
      'داخل السيرفر منذ',
      escapeXML(
        `${membership.days} يوم و ${membership.hours} ساعة`
      ),
      '▦'
    )}

    ${bigBox(
      497,
      535,
      405,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${messages} رسالة`,
      '☏'
    )}

    ${bigBox(
      939,
      535,
      405,
      'وقت المكالمات',
      'إجمالي وقت المكالمات',
      voiceTime,
      '♫'
    )}

    <!-- EXTRA STATS -->

    ${smallBox(
      55,
      785,
      285,
      'عمر الحساب',
      escapeXML(accountAge),
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
      359,
      'حالة العضو',
      escapeXML(status.text),
      '♥'
    )}

    <!-- NEW ROW -->

    ${smallBox(
      55,
      985,
      405,
      'اسم العضو',
      nickname.length > 22
        ? nickname.substring(0, 22) + '...'
        : nickname,
      '♟'
    )}

    ${smallBox(
      497,
      985,
      405,
      'تاريخ الانضمام',
      joinDate,
      '◈'
    )}

    ${smallBox(
      939,
      985,
      405,
      'عمر الحساب',
      accountAge,
      '◉'
    )}

    <!-- NEW ROW -->

    ${smallBox(
      55,
      1185,
      405,
      'تاريخ إنشاء الحساب',
      accountDate,
      '◷'
    )}

    ${smallBox(
      497,
      1185,
      405,
      'معرّف العضو',
      member.user.id,
      '#'
    )}

    ${smallBox(
      939,
      1185,
      405,
      'عدد الرتب',
      `${roleCount} رتبة`,
      '♢'
    )}

    <!-- FOOTER -->

    <path
      d="M55 1390H1345"
      stroke="url(#red)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <text
      x="700"
      y="1420"
      text-anchor="middle"
      fill="#ff2525"
      font-size="34"
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

// =========================
// SLASH COMMAND
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة تعريفك وإحصائياتك'
    )
].map(command =>
  command.toJSON()
);

// =========================
// REGISTER
// =========================

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
      '❌ تسجيل الأمر:',
      error
    );
  }
}

// =========================
// READY
// =========================

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

// =========================
// MESSAGE TRACKING
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

    saveData();
  }
);

// =========================
// VOICE TRACKING
// =========================

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

    // دخل فويس
    if (
      !oldState.channel &&
      newState.channel
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }

    // خرج من الفويس
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

    // انتقل من روم لروم
    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !==
        newState.channel.id &&
      !memberData.voiceStarted
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();
    }
  }
);

// =========================
// /DNA
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
      interaction.commandName !==
      'dna'
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
        flags: MessageFlags.Ephemeral
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
        '❌ DNA ERROR:',
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
// SAVE ON EXIT
// =========================

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

// =========================
// LOGIN
// =========================

client.login(TOKEN);
