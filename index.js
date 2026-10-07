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

/* =========================
   CONFIG
========================= */

const CLIENT_ID = "1557370938650271824";
const TOKEN = process.env.DISCORD_TOKEN;

/* =========================
   CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =========================
   DATA
========================= */

const DATA_FILE = path.join(__dirname, "data.json");

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("❌ Failed to read data.json");
    data = {};
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Failed to save data:", error);
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

/* =========================
   FORMAT
========================= */

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  const parts = [];

  if (days) {
    parts.push(`${days} يوم`);
  }

  if (hours) {
    parts.push(`${hours} ساعة`);
  }

  if (minutes || parts.length === 0) {
    parts.push(`${minutes} دقيقة`);
  }

  return parts.join(" و ");
}

function formatMembership(date) {
  if (!date) {
    return "غير معروف";
  }

  const diff = Math.max(0, Date.now() - date.getTime());

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(
    (diff % 86400000) / 3600000
  );

  if (days > 0) {
    return `${days} يوم${hours ? ` و ${hours} ساعة` : ""}`;
  }

  return `${hours} ساعة`;
}

/* =========================
   DNA IMAGE
========================= */

async function createDNAImage(member, memberData) {
  const width = 1000;
  const height = 560;

  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 256
  });

  let avatarBuffer = null;

  try {
    const response = await fetch(avatarURL);

    if (response.ok) {
      avatarBuffer = await response.arrayBuffer();
    }
  } catch (error) {
    console.error("⚠️ Failed to download avatar");
  }

  const avatarBase64 = avatarBuffer
    ? Buffer.from(avatarBuffer).toString("base64")
    : "";

  const currentVoiceSeconds =
    memberData.voiceSeconds +
    (
      memberData.voiceStarted
        ? Math.floor(
            (Date.now() - memberData.voiceStarted) / 1000
          )
        : 0
    );

  const messages =
    memberData.messages.toLocaleString("en-US");

  const voiceTime =
    formatDuration(currentVoiceSeconds);

  const joined =
    member.joinedAt
      ? formatMembership(member.joinedAt)
      : "غير معروف";

  const safeName = String(member.user.username)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const avatarCircle = avatarBase64
    ? `
      <defs>
        <clipPath id="avatarClip">
          <circle cx="135" cy="130" r="82"/>
        </clipPath>
      </defs>

      <image
        href="data:image/png;base64,${avatarBase64}"
        x="53"
        y="48"
        width="164"
        height="164"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
    `
    : "";

  const svg = `
  <svg
    width="${width}"
    height="${height}"
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
        <stop
          offset="0%"
          stop-color="#050505"
        />

        <stop
          offset="55%"
          stop-color="#100505"
        />

        <stop
          offset="100%"
          stop-color="#050505"
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
          stop-color="#ff1515"
        />

        <stop
          offset="100%"
          stop-color="#8b0000"
        />
      </linearGradient>

      <filter id="glow">
        <feGaussianBlur
          stdDeviation="8"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

    </defs>

    <!-- Background -->

    <rect
      width="1000"
      height="560"
      rx="35"
      fill="url(#bg)"
    />

    <circle
      cx="900"
      cy="80"
      r="180"
      fill="#8b0000"
      opacity="0.08"
    />

    <circle
      cx="80"
      cy="500"
      r="220"
      fill="#ff0000"
      opacity="0.05"
    />

    <!-- Border -->

    <rect
      x="25"
      y="25"
      width="950"
      height="510"
      rx="30"
      fill="none"
      stroke="#8b0000"
      stroke-width="2"
      opacity="0.7"
    />

    <!-- Title -->

    <text
      x="500"
      y="65"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="30"
      font-weight="bold"
    >
      NEON • DNA
    </text>

    <text
      x="500"
      y="95"
      text-anchor="middle"
      fill="#777"
      font-family="Arial"
      font-size="15"
    >
      MEMBER PROFILE
    </text>

    <!-- Avatar -->

    <circle
      cx="135"
      cy="130"
      r="92"
      fill="#160000"
      stroke="#ff1515"
      stroke-width="4"
      filter="url(#glow)"
    />

    ${avatarCircle}

    <!-- Username -->

    <text
      x="260"
      y="125"
      fill="#ffffff"
      font-family="Arial"
      font-size="32"
      font-weight="bold"
    >
      ${safeName}
    </text>

    <text
      x="260"
      y="153"
      fill="#777"
      font-family="Arial"
      font-size="16"
    >
      @${safeName}
    </text>

    <!-- Membership -->

    <rect
      x="50"
      y="230"
      width="285"
      height="125"
      rx="22"
      fill="#0d0d0d"
      stroke="#3a0b0b"
    />

    <text
      x="75"
      y="270"
      fill="#ff2020"
      font-family="Arial"
      font-size="25"
    >
      DATE
    </text>

    <text
      x="115"
      y="270"
      fill="#888"
      font-family="Arial"
      font-size="16"
    >
      داخل السيرفر منذ
    </text>

    <text
      x="75"
      y="315"
      fill="#ffffff"
      font-family="Arial"
      font-size="25"
      font-weight="bold"
    >
      ${joined}
    </text>

    <!-- Messages -->

    <rect
      x="355"
      y="230"
      width="285"
      height="125"
      rx="22"
      fill="#0d0d0d"
      stroke="#3a0b0b"
    />

    <text
      x="380"
      y="270"
      fill="#ff2020"
      font-family="Arial"
      font-size="25"
    >
      MSG
    </text>

    <text
      x="420"
      y="270"
      fill="#888"
      font-family="Arial"
      font-size="16"
    >
      الرسائل
    </text>

    <text
      x="380"
      y="315"
      fill="#ffffff"
      font-family="Arial"
      font-size="25"
      font-weight="bold"
    >
      ${messages}
    </text>

    <!-- Voice -->

    <rect
      x="660"
      y="230"
      width="285"
      height="125"
      rx="22"
      fill="#0d0d0d"
      stroke="#3a0b0b"
    />

    <text
      x="685"
      y="270"
      fill="#ff2020"
      font-family="Arial"
      font-size="25"
    >
      VOICE
    </text>

    <text
      x="725"
      y="270"
      fill="#888"
      font-family="Arial"
      font-size="16"
    >
      وقت المكالمات
    </text>

    <text
      x="685"
      y="315"
      fill="#ffffff"
      font-family="Arial"
      font-size="23"
      font-weight="bold"
    >
      ${voiceTime}
    </text>

    <!-- Line -->

    <rect
      x="50"
      y="400"
      width="895"
      height="3"
      fill="url(#red)"
      opacity="0.7"
    />

    <!-- Footer -->

    <text
      x="500"
      y="455"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      NEON • GANG
    </text>

    <text
      x="500"
      y="485"
      text-anchor="middle"
      fill="#555"
      font-family="Arial"
      font-size="14"
    >
      DNA MEMBER SYSTEM
    </text>

  </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/* =========================
   SLASH COMMANDS
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName("dna")
    .setDescription(
      "🧬 عرض تعريف العضو وإحصائياته"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "العضو الذي تريد عرض بياناته"
        )
        .setRequired(false)
    )
].map(command => command.toJSON());

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(
    `✅ Logged in as ${client.user.tag}`
  );

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  try {
    console.log("⏳ Registering /dna...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(
      "✅ /dna registered successfully!"
    );

  } catch (error) {
    console.error(
      "❌ Command registration error:"
    );

    console.error(error);
  }
});

/* =========================
   MESSAGE COUNTER
========================= */

client.on("messageCreate", message => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const memberData = getMemberData(
    message.guild.id,
    message.author.id
  );

  memberData.messages++;

  saveData();
});

/* =========================
   VOICE TRACKER
========================= */

client.on(
  "voiceStateUpdate",
  (oldState, newState) => {

    if (!newState.guild) return;

    if (newState.member?.user.bot) {
      return;
    }

    const memberData = getMemberData(
      newState.guild.id,
      newState.id
    );

    const wasInVoice =
      !!oldState.channelId;

    const isInVoice =
      !!newState.channelId;

    /* دخول الروم */

    if (!wasInVoice && isInVoice) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }

    /* الخروج من الروم */

    if (wasInVoice && !isInVoice) {

      if (memberData.voiceStarted) {

        memberData.voiceSeconds +=
          Math.floor(
            (
              Date.now() -
              memberData.voiceStarted
            ) / 1000
          );
      }

      memberData.voiceStarted = null;

      saveData();
    }
  }
);

/* =========================
   INTERACTIONS
========================= */

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName !== "dna") {
      return;
    }

    try {

      await interaction.deferReply();

      const selectedUser =
        interaction.options.getUser(
          "member"
        ) || interaction.user;

      const member =
        await interaction.guild.members
          .fetch(selectedUser.id)
          .catch(() => null);

      if (!member) {

        return interaction.editReply(
          "❌ العضو ده مش موجود في السيرفر."
        );
      }

      const memberData =
        getMemberData(
          interaction.guild.id,
          selectedUser.id
        );

      const image =
        await createDNAImage(
          member,
          memberData
        );

      const attachment =
        new AttachmentBuilder(
          image,
          {
            name: "dna.png"
          }
        );

      await interaction.editReply({
        files: [attachment]
      });

    } catch (error) {

      console.error(
        "❌ DNA command error:",
        error
      );

      if (interaction.deferred) {

        await interaction.editReply(
          "❌ حصل خطأ أثناء إنشاء بطاقة DNA."
        ).catch(() => {});

      } else {

        await interaction.reply({
          content:
            "❌ حصل خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

/* =========================
   ERRORS
========================= */

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

/* =========================
   LOGIN
========================= */

if (!TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN is missing!"
  );

  process.exit(1);
}

client.login(TOKEN);
