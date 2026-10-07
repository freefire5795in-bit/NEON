const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ===============================
// NEON CONFIG
// ===============================

const CLIENT_ID = "1557370938650271824";
const DNA_CHANNEL_ID = "1557391771527553125";
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود.");
  process.exit(1);
}

// ===============================
// CLIENT
// ===============================

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

// ===============================
// DATA
// ===============================

const DATA_FILE = path.join(__dirname, "data.json");

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    data = {};
  }
}

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function getMemberData(userId) {
  if (!data[userId]) {
    data[userId] = {
      messages: 0,
      voiceSeconds: 0,
      voiceStarted: null
    };
  }

  return data[userId];
}

// ===============================
// HELPERS
// ===============================

function escapeXML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatVoiceTime(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getMembershipTime(member) {
  if (!member.joinedTimestamp) {
    return "Unknown";
  }

  const diff = Date.now() - member.joinedTimestamp;

  const days = Math.floor(diff / 86400000);

  if (days < 1) {
    return "Today";
  }

  if (days < 30) {
    return `${days}d`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths > 0) {
    return `${years}y ${remainingMonths}mo`;
  }

  return `${years}y`;
}

function getAccountAge(user) {
  const diff = Date.now() - user.createdTimestamp;

  const days = Math.floor(diff / 86400000);

  if (days < 30) {
    return `${days}d`;
  }

  const months = Math.floor(days / 30);

  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(months / 12);

  return `${years}y`;
}

function getMemberStatus(member) {
  const status = member.presence?.status;

  if (status === "online") return "ONLINE";
  if (status === "idle") return "IDLE";
  if (status === "dnd") return "DND";

  return "OFFLINE";
}

// ===============================
// MEMBER NUMBER
// ===============================

async function getMemberNumber(guild, member) {
  const members = await guild.members.fetch();

  const humans = members
    .filter(m => !m.user.bot)
    .sort((a, b) => {
      return (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0);
    });

  const index = humans.findIndex(m => m.id === member.id);

  return index >= 0 ? index + 1 : humans.size;
}

// ===============================
// DNA IMAGE
// ===============================

async function createDNAImage(member, stats, memberNumber) {
  const width = 1320;
  const height = 1150;

  const username = escapeXML(member.user.username);
  const displayName = escapeXML(
    member.displayName || member.user.username
  );

  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 512,
    forceStatic: true
  });

  const avatarBuffer = await fetch(avatarURL)
    .then(res => {
      if (!res.ok) {
        throw new Error("Failed to download avatar");
      }

      return res.arrayBuffer();
    })
    .then(buffer => Buffer.from(buffer));

  const avatar = await sharp(avatarBuffer)
    .resize(270, 270, {
      fit: "cover"
    })
    .png()
    .toBuffer();

  const avatarBase64 = avatar.toString("base64");

  const status = getMemberStatus(member);

  let statusColor = "#777777";

  if (status === "ONLINE") statusColor = "#00ff88";
  if (status === "IDLE") statusColor = "#ffaa00";
  if (status === "DND") statusColor = "#ff3333";

  const roleCount = Math.max(
    0,
    member.roles.cache.filter(role => role.id !== member.guild.id).size
  );

  const voiceTime = formatVoiceTime(stats.voiceSeconds);
  const accountAge = getAccountAge(member.user);
  const membership = getMembershipTime(member);

  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">

  <defs>

    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050505"/>
      <stop offset="55%" stop-color="#120000"/>
      <stop offset="100%" stop-color="#050505"/>
    </linearGradient>

    <linearGradient id="red" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff0000"/>
      <stop offset="50%" stop-color="#ff3030"/>
      <stop offset="100%" stop-color="#8b0000"/>
    </linearGradient>

    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <clipPath id="avatarClip">
      <circle cx="205" cy="270" r="135"/>
    </clipPath>

  </defs>

  <!-- BACKGROUND -->
  <rect width="1320" height="1150" rx="45" fill="url(#bg)"/>

  <!-- BORDER -->
  <rect
    x="12"
    y="12"
    width="1296"
    height="1126"
    rx="42"
    fill="none"
    stroke="#ff1111"
    stroke-width="4"
    opacity="0.8"
  />

  <!-- TOP RED LINE -->
  <rect
    x="70"
    y="70"
    width="1180"
    height="8"
    rx="4"
    fill="url(#red)"
    filter="url(#glow)"
  />

  <!-- BRAND -->
  <text
    x="70"
    y="140"
    fill="#ffffff"
    font-size="42"
    font-family="Arial"
    font-weight="900"
    letter-spacing="7"
  >
    NEON
  </text>

  <text
    x="70"
    y="175"
    fill="#ff2222"
    font-size="18"
    font-family="Arial"
    font-weight="700"
    letter-spacing="5"
  >
    MEMBER DNA SYSTEM
  </text>

  <!-- AVATAR BORDER -->
  <circle
    cx="205"
    cy="270"
    r="150"
    fill="none"
    stroke="#ff1111"
    stroke-width="5"
    opacity="0.8"
    filter="url(#glow)"
  />

  <!-- AVATAR -->
  <image
    href="data:image/png;base64,${avatarBase64}"
    x="70"
    y="135"
    width="270"
    height="270"
    preserveAspectRatio="xMidYMid slice"
    clip-path="url(#avatarClip)"
  />

  <!-- STATUS -->
  <circle
    cx="300"
    cy="370"
    r="22"
    fill="${statusColor}"
    stroke="#050505"
    stroke-width="8"
  />

  <!-- USER INFO -->
  <text
    x="400"
    y="235"
    fill="#ffffff"
    font-size="48"
    font-family="Arial"
    font-weight="900"
  >
    ${displayName}
  </text>

  <text
    x="400"
    y="285"
    fill="#ff3333"
    font-size="27"
    font-family="Arial"
    font-weight="700"
  >
    @${username}
  </text>

  <text
    x="400"
    y="335"
    fill="#888888"
    font-size="21"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    STATUS
  </text>

  <text
    x="400"
    y="370"
    fill="${statusColor}"
    font-size="28"
    font-family="Arial"
    font-weight="900"
  >
    ${status}
  </text>

  <!-- MEMBER NUMBER -->
  <rect
    x="1010"
    y="205"
    width="220"
    height="150"
    rx="25"
    fill="#100000"
    stroke="#ff2222"
    stroke-width="3"
  />

  <text
    x="1120"
    y="250"
    text-anchor="middle"
    fill="#888888"
    font-size="18"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    MEMBER
  </text>

  <text
    x="1120"
    y="320"
    text-anchor="middle"
    fill="#ff2222"
    font-size="55"
    font-family="Arial"
    font-weight="900"
  >
    #${memberNumber}
  </text>

  <!-- DIVIDER -->
  <line
    x1="70"
    y1="450"
    x2="1250"
    y2="450"
    stroke="#ff2222"
    stroke-width="2"
    opacity="0.5"
  />

  <!-- STAT CARD 1 -->
  <rect
    x="70"
    y="500"
    width="370"
    height="190"
    rx="25"
    fill="#0d0d0d"
    stroke="#2b0000"
    stroke-width="3"
  />

  <text
    x="100"
    y="545"
    fill="#777777"
    font-size="18"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    MESSAGES
  </text>

  <text
    x="100"
    y="625"
    fill="#ffffff"
    font-size="52"
    font-family="Arial"
    font-weight="900"
  >
    ${stats.messages.toLocaleString()}
  </text>

  <text
    x="100"
    y="660"
    fill="#ff2222"
    font-size="16"
    font-family="Arial"
    font-weight="700"
  >
    TOTAL ACTIVITY
  </text>

  <!-- STAT CARD 2 -->
  <rect
    x="475"
    y="500"
    width="370"
    height="190"
    rx="25"
    fill="#0d0d0d"
    stroke="#2b0000"
    stroke-width="3"
  />

  <text
    x="505"
    y="545"
    fill="#777777"
    font-size="18"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    VOICE TIME
  </text>

  <text
    x="505"
    y="625"
    fill="#ffffff"
    font-size="52"
    font-family="Arial"
    font-weight="900"
  >
    ${voiceTime}
  </text>

  <text
    x="505"
    y="660"
    fill="#ff2222"
    font-size="16"
    font-family="Arial"
    font-weight="700"
  >
    VOICE ACTIVITY
  </text>

  <!-- STAT CARD 3 -->
  <rect
    x="880"
    y="500"
    width="370"
    height="190"
    rx="25"
    fill="#0d0d0d"
    stroke="#2b0000"
    stroke-width="3"
  />

  <text
    x="910"
    y="545"
    fill="#777777"
    font-size="18"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    ROLES
  </text>

  <text
    x="910"
    y="625"
    fill="#ffffff"
    font-size="52"
    font-family="Arial"
    font-weight="900"
  >
    ${roleCount}
  </text>

  <text
    x="910"
    y="660"
    fill="#ff2222"
    font-size="16"
    font-family="Arial"
    font-weight="700"
  >
    SERVER ROLES
  </text>

  <!-- EXTRA INFO -->
  <rect
    x="70"
    y="735"
    width="1180"
    height="250"
    rx="28"
    fill="#090909"
    stroke="#210000"
    stroke-width="3"
  />

  <!-- MEMBERSHIP -->
  <text
    x="110"
    y="790"
    fill="#777777"
    font-size="17"
    font-family="Arial"
    font-weight="700"
    letter-spacing="2"
  >
    SERVER MEMBERSHIP
  </text>

  <text
    x="110"
    y="835"
    fill="#ffffff"
    font-size="30"
    font-family="Arial"
    font-weight="900"
  >
    ${membership}
  </text>

  <!-- ACCOUNT AGE -->
  <text
    x="500"
    y="790"
    fill="#777777"
    font-size="17"
    font-family="Arial"
    font-weight="700"
    letter-spacing="2"
  >
    ACCOUNT AGE
  </text>

  <text
    x="500"
    y="835"
    fill="#ffffff"
    font-size="30"
    font-family="Arial"
    font-weight="900"
  >
    ${accountAge}
  </text>

  <!-- RANK -->
  <text
    x="850"
    y="790"
    fill="#777777"
    font-size="17"
    font-family="Arial"
    font-weight="700"
    letter-spacing="2"
  >
    MEMBER RANK
  </text>

  <text
    x="850"
    y="835"
    fill="#ff2222"
    font-size="30"
    font-family="Arial"
    font-weight="900"
  >
    #${memberNumber}
  </text>

  <!-- FOOTER -->
  <line
    x1="110"
    y1="900"
    x2="1210"
    y2="900"
    stroke="#ff2222"
    stroke-width="2"
    opacity="0.4"
  />

  <text
    x="110"
    y="945"
    fill="#555555"
    font-size="15"
    font-family="Arial"
    font-weight="700"
    letter-spacing="4"
  >
    NEON COMMUNITY • MEMBER PROFILE
  </text>

  <text
    x="1210"
    y="945"
    text-anchor="end"
    fill="#ff2222"
    font-size="15"
    font-family="Arial"
    font-weight="700"
    letter-spacing="3"
  >
    DNA SYSTEM
  </text>

</svg>
`;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// ===============================
// SLASH COMMAND
// ===============================

const commands = [
  new SlashCommandBuilder()
    .setName("dna")
    .setDescription("عرض بطاقة DNA الخاصة بك")
    .toJSON()
];

// ===============================
// REGISTER COMMAND
// ===============================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("⏳ تسجيل أوامر NEON...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ تم تسجيل /dna بنجاح.");
  } catch (error) {
    console.error("❌ خطأ في تسجيل الأمر:", error);
  }
}

// ===============================
// READY
// ===============================

client.once("ready", async () => {
  console.log(`✅ NEON BOT ONLINE: ${client.user.tag}`);

  await registerCommands();
});

// ===============================
// MESSAGE TRACKING
// ===============================

client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const memberData = getMemberData(message.author.id);

  memberData.messages++;

  saveData();
});

// ===============================
// VOICE TRACKING
// ===============================

client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;

  if (!member || member.user.bot) return;

  const memberData = getMemberData(member.id);

  // دخل روم صوتي
  if (!oldState.channelId && newState.channelId) {
    memberData.voiceStarted = Date.now();

    saveData();
    return;
  }

  // خرج من روم صوتي
  if (oldState.channelId && !newState.channelId) {
    if (memberData.voiceStarted) {
      const elapsed = Math.floor(
        (Date.now() - memberData.voiceStarted) / 1000
      );

      memberData.voiceSeconds += Math.max(0, elapsed);
      memberData.voiceStarted = null;

      saveData();
    }
  }
});

// ===============================
// INTERACTIONS
// ===============================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "dna") return;

  // القناة المسموح فيها
  if (interaction.channelId !== DNA_CHANNEL_ID) {
    await interaction.reply({
      content:
        `❌ أمر **/dna** متاح فقط في <#${DNA_CHANNEL_ID}>`,
      ephemeral: true
    });

    return;
  }

  try {
    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(
      interaction.user.id
    );

    const memberData = getMemberData(member.id);

    // لو كان داخل فويس حاليًا، نحسب الوقت الحالي
    let voiceSeconds = memberData.voiceSeconds;

    if (memberData.voiceStarted) {
      voiceSeconds += Math.floor(
        (Date.now() - memberData.voiceStarted) / 1000
      );
    }

    const stats = {
      messages: memberData.messages,
      voiceSeconds
    };

    const memberNumber = await getMemberNumber(
      interaction.guild,
      member
    );

    const image = await createDNAImage(
      member,
      stats,
      memberNumber
    );

    const attachment = new AttachmentBuilder(image, {
      name: "neon-dna.png"
    });

    await interaction.editReply({
      content: `🧬 **NEON DNA — ${member.user.username}**`,
      files: [attachment]
    });

  } catch (error) {
    console.error("❌ DNA ERROR:", error);

    const message = {
      content:
        "❌ حصل خطأ أثناء إنشاء بطاقة DNA. تأكد أن البوت لديه الصلاحيات المطلوبة وأن `sharp` مثبت بشكل صحيح."
    };

    if (interaction.deferred) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({
        ...message,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ===============================
// SAVE ON EXIT
// ===============================

process.on("SIGINT", () => {
  saveData();
  process.exit(0);
});

process.on("SIGTERM", () => {
  saveData();
  process.exit(0);
});

// ===============================
// LOGIN
// ===============================

client.login(TOKEN);
