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

/* =========================================
   CONFIG
========================================= */

const CLIENT_ID = "1557370938650271824";
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Environment Variables");
  process.exit(1);
}

/* =========================================
   DISCORD CLIENT
========================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =========================================
   DATA FILE
========================================= */

const DATA_FILE = path.join(__dirname, "data.json");

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch (error) {
    console.error("⚠️ مشكلة في قراءة data.json");
    data = {};
  }
}

/* =========================================
   SAVE DATA
========================================= */

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(
      "❌ خطأ أثناء حفظ البيانات:",
      error
    );
  }
}

/* =========================================
   MEMBER DATA
========================================= */

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

/* =========================================
   FORMAT VOICE TIME
========================================= */

function formatDuration(seconds) {
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

  const parts = [];

  if (days) {
    parts.push(`${days} يوم`);
  }

  if (hours) {
    parts.push(`${hours} ساعة`);
  }

  if (
    minutes ||
    parts.length === 0
  ) {
    parts.push(`${minutes} دقيقة`);
  }

  return parts.join(" و ");
}

/* =========================================
   FORMAT MEMBERSHIP
========================================= */

function formatMembership(date) {
  if (!date) {
    return "غير معروف";
  }

  const diff = Math.max(
    0,
    Date.now() - date.getTime()
  );

  const days = Math.floor(
    diff / 86400000
  );

  const hours = Math.floor(
    (diff % 86400000) / 3600000
  );

  if (days > 0) {
    return `${days} يوم${
      hours ? ` و ${hours} ساعة` : ""
    }`;
  }

  return `${hours} ساعة`;
}

/* =========================================
   ESCAPE SVG TEXT
========================================= */

function escapeXML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================
   CREATE DNA IMAGE
========================================= */

async function createDNAImage(
  member,
  memberData
) {
  const width = 1000;
  const height = 560;

  /* -----------------------------------------
     AVATAR
  ----------------------------------------- */

  const avatarURL =
    member.user.displayAvatarURL({
      extension: "png",
      size: 256
    });

  let avatarBuffer = null;

  try {
    const response =
      await fetch(avatarURL);

    if (response.ok) {
      avatarBuffer =
        await response.arrayBuffer();
    }
  } catch (error) {
    console.error(
      "⚠️ فشل تحميل صورة العضو"
    );
  }

  const avatarBase64 =
    avatarBuffer
      ? Buffer.from(
          avatarBuffer
        ).toString("base64")
      : "";

  /* -----------------------------------------
     VOICE
  ----------------------------------------- */

  const currentVoiceSeconds =
    memberData.voiceSeconds +
    (
      memberData.voiceStarted
        ? Math.floor(
            (
              Date.now() -
              memberData.voiceStarted
            ) / 1000
          )
        : 0
    );

  /* -----------------------------------------
     DATA
  ----------------------------------------- */

  const messages =
    memberData.messages.toLocaleString(
      "en-US"
    );

  const voiceTime =
    formatDuration(
      currentVoiceSeconds
    );

  const joined =
    member.joinedAt
      ? formatMembership(
          member.joinedAt
        )
      : "غير معروف";

  const username =
    escapeXML(
      member.user.username
    );

  /* -----------------------------------------
     AVATAR SVG
  ----------------------------------------- */

  const avatarCircle =
    avatarBase64
      ? `
        <defs>
          <clipPath id="avatarClip">
            <circle
              cx="135"
              cy="135"
              r="82"
            />
          </clipPath>
        </defs>

        <image
          href="data:image/png;base64,${avatarBase64}"
          x="53"
          y="53"
          width="164"
          height="164"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `
      : "";

  /* =========================================
     SVG
  ========================================= */

  const svg = `
  <svg
    width="${width}"
    height="${height}"
    viewBox="0 0 1000 560"
    xmlns="http://www.w3.org/2000/svg"
  >

    <defs>

      <!-- Background -->
      <linearGradient
        id="background"
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
          offset="50%"
          stop-color="#100303"
        />

        <stop
          offset="100%"
          stop-color="#030303"
        />
      </linearGradient>

      <!-- Red Line -->
      <linearGradient
        id="redLine"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset="0%"
          stop-color="#650000"
        />

        <stop
          offset="50%"
          stop-color="#ff2020"
        />

        <stop
          offset="100%"
          stop-color="#650000"
        />
      </linearGradient>

      <!-- Glow -->
      <filter id="redGlow">
        <feGaussianBlur
          stdDeviation="7"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Shadow -->
      <filter id="shadow">
        <feDropShadow
          dx="0"
          dy="6"
          stdDeviation="8"
          flood-color="#000000"
          flood-opacity="0.65"
        />
      </filter>

    </defs>

    <!-- =====================================
         BACKGROUND
    ====================================== -->

    <rect
      width="1000"
      height="560"
      rx="38"
      fill="url(#background)"
    />

    <circle
      cx="900"
      cy="70"
      r="180"
      fill="#9b0000"
      opacity="0.08"
    />

    <circle
      cx="40"
      cy="500"
      r="190"
      fill="#ff0000"
      opacity="0.045"
    />

    <!-- =====================================
         MAIN BORDER
    ====================================== -->

    <rect
      x="24"
      y="24"
      width="952"
      height="512"
      rx="30"
      fill="none"
      stroke="#760000"
      stroke-width="2"
    />

    <!-- =====================================
         HEADER
    ====================================== -->

    <text
      x="500"
      y="63"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="31"
      font-weight="bold"
      letter-spacing="2"
    >
      NEON • DNA
    </text>

    <text
      x="500"
      y="91"
      text-anchor="middle"
      fill="#666666"
      font-family="Arial"
      font-size="14"
      letter-spacing="3"
    >
      MEMBER PROFILE
    </text>

    <!-- =====================================
         AVATAR
    ====================================== -->

    <circle
      cx="135"
      cy="135"
      r="96"
      fill="#090000"
      stroke="#4d0000"
      stroke-width="2"
    />

    <circle
      cx="135"
      cy="135"
      r="91"
      fill="none"
      stroke="#ff1515"
      stroke-width="4"
      filter="url(#redGlow)"
    />

    ${avatarCircle}

    <!-- =====================================
         USERNAME
    ====================================== -->

    <text
      x="270"
      y="125"
      fill="#ffffff"
      font-family="Arial"
      font-size="32"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="270"
      y="153"
      fill="#666666"
      font-family="Arial"
      font-size="16"
    >
      @${username}
    </text>

    <rect
      x="270"
      y="174"
      width="210"
      height="3"
      rx="2"
      fill="#ff2020"
    />

    <!-- =====================================
         CARD 1
    ====================================== -->

    <rect
      x="50"
      y="225"
      width="285"
      height="145"
      rx="22"
      fill="#0a0a0a"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="75"
      y="258"
      fill="#ff2020"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
      letter-spacing="1"
    >
      MEMBER TIME
    </text>

    <text
      x="75"
      y="286"
      fill="#888888"
      font-family="Arial"
      font-size="15"
    >
      داخل السيرفر منذ
    </text>

    <text
      x="75"
      y="326"
      fill="#ffffff"
      font-family="Arial"
      font-size="23"
      font-weight="bold"
    >
      ${joined}
    </text>

    <!-- =====================================
         CARD 2
    ====================================== -->

    <rect
      x="357"
      y="225"
      width="285"
      height="145"
      rx="22"
      fill="#0a0a0a"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="382"
      y="258"
      fill="#ff2020"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
      letter-spacing="1"
    >
      MESSAGES
    </text>

    <text
      x="382"
      y="286"
      fill="#888888"
      font-family="Arial"
      font-size="15"
    >
      إجمالي الرسائل
    </text>

    <text
      x="382"
      y="326"
      fill="#ffffff"
      font-family="Arial"
      font-size="27"
      font-weight="bold"
    >
      ${messages}
    </text>

    <!-- =====================================
         CARD 3
    ====================================== -->

    <rect
      x="665"
      y="225"
      width="285"
      height="145"
      rx="22"
      fill="#0a0a0a"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="690"
      y="258"
      fill="#ff2020"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
      letter-spacing="1"
    >
      VOICE TIME
    </text>

    <text
      x="690"
      y="286"
      fill="#888888"
      font-family="Arial"
      font-size="15"
    >
      وقت المكالمات
    </text>

    <text
      x="690"
      y="326"
      fill="#ffffff"
      font-family="Arial"
      font-size="22"
      font-weight="bold"
    >
      ${voiceTime}
    </text>

    <!-- =====================================
         DIVIDER
    ====================================== -->

    <rect
      x="50"
      y="400"
      width="900"
      height="3"
      rx="2"
      fill="url(#redLine)"
    />

    <!-- =====================================
         FOOTER
    ====================================== -->

    <text
      x="500"
      y="450"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="19"
      font-weight="bold"
      letter-spacing="2"
    >
      NEON • GANG
    </text>

    <text
      x="500"
      y="478"
      text-anchor="middle"
      fill="#555555"
      font-family="Arial"
      font-size="13"
      letter-spacing="2"
    >
      DNA MEMBER SYSTEM
    </text>

  </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

/* =========================================
   SLASH COMMAND
========================================= */

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
].map(command =>
  command.toJSON()
);

/* =========================================
   READY
========================================= */

client.once(
  "ready",
  async () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    try {

      console.log(
        "⏳ Registering /dna..."
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
        "✅ /dna registered successfully!"
      );

    } catch (error) {

      console.error(
        "❌ Command registration error:"
      );

      console.error(error);
    }
  }
);

/* =========================================
   MESSAGE COUNTER
========================================= */

client.on(
  "messageCreate",
  message => {

    if (!message.guild) {
      return;
    }

    if (message.author.bot) {
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

/* =========================================
   VOICE TRACKER
========================================= */

client.on(
  "voiceStateUpdate",
  (oldState, newState) => {

    if (!newState.guild) {
      return;
    }

    if (newState.member?.user.bot) {
      return;
    }

    const memberData =
      getMemberData(
        newState.guild.id,
        newState.id
      );

    const wasInVoice =
      !!oldState.channelId;

    const isInVoice =
      !!newState.channelId;

    /* دخول المكالمة */

    if (
      !wasInVoice &&
      isInVoice
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }

    /* الخروج من المكالمة */

    if (
      wasInVoice &&
      !isInVoice
    ) {

      if (
        memberData.voiceStarted
      ) {

        memberData.voiceSeconds +=
          Math.floor(
            (
              Date.now() -
              memberData.voiceStarted
            ) / 1000
          );
      }

      memberData.voiceStarted =
        null;

      saveData();
    }
  }
);

/* =========================================
   INTERACTION
========================================= */

client.on(
  "interactionCreate",
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (
      interaction.commandName !== "dna"
    ) {
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
          .fetch(
            selectedUser.id
          )
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

        await interaction
          .editReply(
            "❌ حصل خطأ أثناء إنشاء بطاقة DNA."
          )
          .catch(() => {});

      } else {

        await interaction
          .reply({
            content:
              "❌ حصل خطأ أثناء تنفيذ الأمر.",
            ephemeral: true
          })
          .catch(() => {});
      }
    }
  }
);

/* =========================================
   ERROR HANDLING
========================================= */

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

/* =========================================
   LOGIN
========================================= */

console.log(
  "⏳ Connecting to Discord..."
);

client.login(TOKEN);
