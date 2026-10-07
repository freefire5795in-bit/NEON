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
// NEON CONFIG
// ═══════════════════════════════════════

const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود.');
  process.exit(1);
}

// ═══════════════════════════════════════
// CLIENT
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
// DATA
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
    console.error('❌ حفظ البيانات:', error);
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
// HELPERS
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

  return `${days} يوم و ${hours} ساعة`;
}

// ═══════════════════════════════════════
// عمر الحساب
// ═══════════════════════════════════════

function getAccountAge(createdAt) {
  if (!createdAt) {
    return 'غير معروف';
  }

  const days = Math.floor(
    Math.max(
      0,
      Date.now() - createdAt.getTime()
    ) / 86400000
  );

  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} سنة`;
  }

  const months = Math.floor(days / 30);

  if (months > 0) {
    return `${months} شهر`;
  }

  return `${days} يوم`;
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
    return `${days} يوم و ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}

// ═══════════════════════════════════════
// STATUS
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
    color: '#777'
  };
}

// ═══════════════════════════════════════
// MEMBER NUMBER
// ═══════════════════════════════════════

async function getMemberNumber(guild, target) {
  try {
    const members =
      await guild.members.fetch();

    const humans = [
      ...members.values()
    ]
      .filter(m => !m.user.bot)
      .sort(
        (a, b) =>
          (a.joinedTimestamp || Infinity) -
          (b.joinedTimestamp || Infinity)
      );

    const index =
      humans.findIndex(
        m => m.id === target.id
      );

    return index < 0
      ? humans.length
      : index + 1;

  } catch (error) {
    console.error(
      '⚠️ رقم العضو:',
      error
    );

    return 1;
  }
}

// ═══════════════════════════════════════
// DATE
// ═══════════════════════════════════════

function formatDate(date) {
  if (!date) return 'غير معروف';

  const d =
    String(date.getDate()).padStart(2, '0');

  const m =
    String(date.getMonth() + 1)
      .padStart(2, '0');

  const y =
    date.getFullYear();

  return `${d}/${m}/${y}`;
}

// ═══════════════════════════════════════
// SAFE VALUE
// ═══════════════════════════════════════

function fitText(text, max = 20) {
  text = String(text);

  if (text.length <= max) {
    return text;
  }

  return text.substring(0, max - 3) + '...';
}

// ═══════════════════════════════════════
// CARD
// ═══════════════════════════════════════

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const width = 1400;
  const height = 1400;

  const username =
    escapeXML(
      member.user.username
    );

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

  const voiceSeconds =
    Math.max(
      0,
      Number(
        memberData.voiceSeconds || 0
      ) +
      (
        memberData.voiceStarted
          ? Math.floor(
              (
                Date.now() -
                memberData.voiceStarted
              ) / 1000
            )
          : 0
      )
    );

  const voice =
    formatVoiceTime(
      voiceSeconds
    );

  // ═════════════════════════════
  // AVATAR
  // ═════════════════════════════

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
      '⚠️ Avatar:',
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

  // ═════════════════════════════
  // STAT BOX
  // ═════════════════════════════

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
      >
        ${icon} ${title}
      </text>

      <text
        x="${x + w / 2}"
        y="${y + 76}"
        text-anchor="middle"
        fill="#8f8f8f"
        font-size="15"
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

  // ═════════════════════════════
  // SMALL BOX
  // ═════════════════════════════

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

  // ═════════════════════════════
  // SVG
  // ═════════════════════════════

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
          cy="345"
          r="155"
        />
      </clipPath>

    </defs>

    <!-- BACKGROUND -->

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

    <!-- FRAME -->

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

    <!-- HEADER -->

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
      font-size="14"
      letter-spacing="5"
    >
      DISCORD SERVER
    </text>

    <text
      x="1070"
      y="52"
      fill="#ff2525"
      font-size="17"
      text-anchor="middle"
      font-weight="bold"
    >
      MORE THAN JUST A SERVER
    </text>

    <text
      x="1070"
      y="80"
      fill="#aaa"
      font-size="17"
      text-anchor="middle"
    >
      WE ARE A FAMILY
    </text>

    <path
      d="M70 122H1330"
      stroke="url(#redLine)"
      stroke-width="4"
      filter="url(#glow)"
    />

    <!-- AVATAR -->

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

    <!-- STATUS -->

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

    <!-- USER -->

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

    <!-- MEMBER NUMBER -->

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
      #${memberNumber}
    </text>

    <!-- STATUS BAR -->

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
    >
      الحالة
    </text>

    <text
      x="620"
      y="417"
      fill="${status.color}"
      font-size="21"
      font-weight="bold"
    >
      ${escapeXML(status.text)}
    </text>

    <!-- PROFILE -->

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
    >
      ملف العضو
    </text>

    <text
      x="1070"
      y="320"
      text-anchor="middle"
      fill="#ccc"
      font-size="21"
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
    >
      NEON MEMBER PROFILE
    </text>

    <!-- MAIN -->

    ${statBox(
      55,
      465,
      405,
      205,
      'مدة العضوية',
      'داخل السيرفر منذ',
      escapeXML(membership),
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
      '☏',
      27
    )}

    ${statBox(
      939,
      465,
      405,
      205,
      'وقت المكالمات',
      'إجمالي وقت الفويس',
      escapeXML(voice),
      '♫',
      25
    )}

    <!-- ROW 1 -->

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
      '♙'
    )}

    ${smallBox(
      705,
      705,
      305,
      'عدد الرتب',
      `${roles} رتبة`,
      '♢'
    )}

    ${smallBox(
      1030,
      705,
      314,
      'عمر الحساب',
      escapeXML(accountAge),
      '◉'
    )}

    <!-- ROW 2 -->

    ${smallBox(
      55,
      900,
      405,
      'اسم العضو',
      fitText(
        nickname,
        22
      ),
      '♟',
      20
    )}

    ${smallBox(
      497,
      900,
      405,
      'تاريخ الانضمام',
      joinDate,
      '◈',
      21
    )}

    ${smallBox(
      939,
      900,
      405,
      'تاريخ إنشاء الحساب',
      accountDate,
      '◷',
      21
    )}

    <!-- ROW 3 -->

    ${smallBox(
      55,
      1095,
      630,
      'معرّف العضو',
      member.user.id,
      '#',
      20
    )}

    ${smallBox(
      705,
      1095,
      639,
      'اسم المستخدم',
      fitText(
        member.user.username,
        25
      ),
      '♛',
      20
    )}

    <!-- FOOTER -->

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
      font-size="13"
      letter-spacing="4"
    >
      MEMBER DNA • PROFILE • STATS
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
// COMMAND
// ═══════════════════════════════════════

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة DNA وإحصائيات العضو'
    )
].map(command =>
  command.toJSON()
);

// ═══════════════════════════════════════
// REGISTER COMMAND
// ═══════════════════════════════════════

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log(
      '🔄 تسجيل /dna...'
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
      '✅ تم تسجيل /dna.'
    );

  } catch (error) {
    console.error(
      '❌ تسجيل الأمر:',
      error
    );
  }
}

// ═══════════════════════════════════════
// READY
// ═══════════════════════════════════════

client.once(
  'ready',
  async () => {

    console.log(
      `✅ البوت يعمل: ${client.user.tag}`
    );

    console.log(
      `📌 DNA Channel: ${DNA_CHANNEL_ID}`
    );

    await registerCommands();
  }
);

// ═══════════════════════════════════════
// MESSAGE TRACKING
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
// VOICE TRACKING
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

    // الخروج من الفويس
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

      if (!memberData.voiceStarted) {
        memberData.voiceStarted =
          Date.now();
      }

      saveData();
    }
  }
);

// ═══════════════════════════════════════
// /DNA
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

    // DNA CHANNEL ONLY
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

// ═══════════════════════════════════════
// SAVE
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
// LOGIN
// ═══════════════════════════════════════

client.login(TOKEN);
