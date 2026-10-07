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

/* =====================================================
   إعدادات البوت
===================================================== */

const CLIENT_ID = "1557370938650271824";
const DNA_CHANNEL_ID = "1557391771527553125";
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في الاستضافة.");
  process.exit(1);
}

/* =====================================================
   تشغيل Discord
===================================================== */

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

/* =====================================================
   ملف البيانات
===================================================== */

const DATA_FILE = path.join(__dirname, "data.json");

let data = {};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    console.log(
      "⚠️ تعذر قراءة ملف البيانات، سيتم إنشاء ملف جديد."
    );

    data = {};
  }
}

/* =====================================================
   حفظ البيانات
===================================================== */

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

/* =====================================================
   بيانات العضو
===================================================== */

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

/* =====================================================
   حساب مدة العضوية
===================================================== */

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
    (difference % 86400000) / 3600000
  );

  return {
    days,
    hours
  };
}

/* =====================================================
   حساب عمر حساب Discord
===================================================== */

function getAccountAge(createdAt) {
  if (!createdAt) {
    return {
      number: 0,
      text: "يوم"
    };
  }

  const difference = Math.max(
    0,
    Date.now() - createdAt.getTime()
  );

  const days = Math.floor(
    difference / 86400000
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
      text: years === 1 ? "سنة" : "سنوات"
    };
  }

  if (months > 0) {
    return {
      number: months,
      text: months === 1 ? "شهر" : "شهور"
    };
  }

  return {
    number: days,
    text: "يوم"
  };
}

/* =====================================================
   وقت المكالمات
===================================================== */

function formatVoiceTime(totalSeconds) {
  totalSeconds = Math.max(
    0,
    Math.floor(totalSeconds)
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  totalSeconds %= 86400;

  const hours = Math.floor(
    totalSeconds / 3600
  );

  totalSeconds %= 3600;

  const minutes = Math.floor(
    totalSeconds / 60
  );

  if (days > 0) {
    return `${days} يوم و ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}

/* =====================================================
   حماية النص داخل SVG
===================================================== */

function escapeXML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =====================================================
   حالة العضو
===================================================== */

function getMemberStatus(member) {
  const status =
    member.presence?.status;

  if (status === "online") {
    return {
      text: "متصل",
      color: "#35e06f"
    };
  }

  if (status === "idle") {
    return {
      text: "خامل",
      color: "#f0b429"
    };
  }

  if (status === "dnd") {
    return {
      text: "مشغول",
      color: "#ff4141"
    };
  }

  return {
    text: "غير متصل",
    color: "#777777"
  };
}

/* =====================================================
   رقم العضو
===================================================== */

async function getMemberNumber(
  guild,
  targetMember
) {
  try {
    const members =
      await guild.members.fetch();

    const humans =
      [...members.values()]
        .filter(member => !member.user.bot)
        .sort((a, b) => {
          const first =
            a.joinedTimestamp || Infinity;

          const second =
            b.joinedTimestamp || Infinity;

          return first - second;
        });

    const index =
      humans.findIndex(
        member =>
          member.id === targetMember.id
      );

    if (index === -1) {
      return humans.length;
    }

    return index + 1;

  } catch (error) {
    console.error(
      "⚠️ تعذر حساب رقم العضو:",
      error
    );

    return 1;
  }
}

/* =====================================================
   إنشاء صورة DNA
===================================================== */

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const width = 1200;
  const height = 700;

  /* ===================================================
     صورة العضو
  =================================================== */

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
  } catch {
    avatarBuffer = null;
  }

  const avatarBase64 =
    avatarBuffer
      ? Buffer.from(
          avatarBuffer
        ).toString("base64")
      : "";

  /* ===================================================
     مدة العضوية
  =================================================== */

  const membership =
    getMembershipTime(
      member.joinedAt
    );

  const days =
    membership.days;

  const hours =
    membership.hours;

  /* ===================================================
     الرسائل
  =================================================== */

  const messages =
    memberData.messages.toLocaleString(
      "en-US"
    );

  /* ===================================================
     وقت المكالمات
  =================================================== */

  const voiceSeconds =
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

  const voiceTime =
    formatVoiceTime(
      voiceSeconds
    );

  /* ===================================================
     اسم العضو
  =================================================== */

  const username =
    escapeXML(
      member.user.username
    );

  /* ===================================================
     عمر الحساب
  =================================================== */

  const accountAge =
    getAccountAge(
      member.user.createdAt
    );

  /* ===================================================
     عدد الرتب
  =================================================== */

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  /* ===================================================
     حالة العضو
  =================================================== */

  const status =
    getMemberStatus(member);

  /* ===================================================
     صورة العضو
  =================================================== */

  const avatarCircle =
    avatarBase64
      ? `
        <defs>
          <clipPath id="avatarClip">
            <circle
              cx="170"
              cy="170"
              r="105"
            />
          </clipPath>
        </defs>

        <image
          href="data:image/png;base64,${avatarBase64}"
          x="65"
          y="65"
          width="210"
          height="210"
          preserveAspectRatio="xMidYMid slice"
          clip-path="url(#avatarClip)"
        />
      `
      : "";

  /* ===================================================
     SVG
  =================================================== */

  const svg = `
  <svg
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg"
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
          stop-color="#010101"
        />

        <stop
          offset="45%"
          stop-color="#160202"
        />

        <stop
          offset="100%"
          stop-color="#020202"
        />
      </linearGradient>

      <!-- الأحمر -->

      <linearGradient
        id="redLine"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset="0%"
          stop-color="#380000"
        />

        <stop
          offset="25%"
          stop-color="#ff1111"
        />

        <stop
          offset="50%"
          stop-color="#ff3333"
        />

        <stop
          offset="75%"
          stop-color="#ff1111"
        />

        <stop
          offset="100%"
          stop-color="#380000"
        />
      </linearGradient>

      <!-- توهج -->

      <filter id="glow">

        <feGaussianBlur
          stdDeviation="6"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>

      </filter>

      <!-- ظل -->

      <filter id="shadow">

        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="8"
          flood-color="#000000"
          flood-opacity="0.8"
        />

      </filter>

    </defs>

    <!-- =================================================
         الخلفية
    ================================================= -->

    <rect
      width="${width}"
      height="${height}"
      rx="45"
      fill="url(#background)"
    />

    <circle
      cx="1080"
      cy="80"
      r="230"
      fill="#ff0000"
      opacity="0.08"
    />

    <circle
      cx="80"
      cy="650"
      r="250"
      fill="#ff0000"
      opacity="0.06"
    />

    <!-- إطار خارجي -->

    <rect
      x="20"
      y="20"
      width="1160"
      height="660"
      rx="40"
      fill="none"
      stroke="#700000"
      stroke-width="3"
    />

    <rect
      x="30"
      y="30"
      width="1140"
      height="640"
      rx="34"
      fill="none"
      stroke="#ff1515"
      stroke-width="2"
      opacity="0.65"
      filter="url(#glow)"
    />

    <!-- =================================================
         رأس البطاقة
    ================================================= -->

    <text
      x="600"
      y="67"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="34"
      font-weight="bold"
    >
      NEON
    </text>

    <text
      x="600"
      y="95"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="15"
    >
      DISCORD SERVER • MEMBER PROFILE
    </text>

    <rect
      x="70"
      y="110"
      width="1060"
      height="3"
      rx="2"
      fill="url(#redLine)"
      filter="url(#glow)"
    />

    <!-- =================================================
         صورة العضو
    ================================================= -->

    <circle
      cx="170"
      cy="170"
      r="125"
      fill="#050000"
      stroke="#430000"
      stroke-width="3"
    />

    <circle
      cx="170"
      cy="170"
      r="116"
      fill="none"
      stroke="#ff1111"
      stroke-width="6"
      filter="url(#glow)"
    />

    ${avatarCircle}

    <!-- نقطة الحالة -->

    <circle
      cx="250"
      cy="255"
      r="18"
      fill="#050505"
      stroke="#ff1111"
      stroke-width="3"
    />

    <circle
      cx="250"
      cy="255"
      r="10"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <!-- =================================================
         بيانات العضو
    ================================================= -->

    <text
      x="330"
      y="155"
      fill="#ffffff"
      font-family="Arial"
      font-size="38"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="330"
      y="185"
      fill="#777777"
      font-family="Arial"
      font-size="16"
    >
      MEMBER PROFILE
    </text>

    <!-- رقم العضو -->

    <rect
      x="330"
      y="205"
      width="240"
      height="55"
      rx="15"
      fill="#090909"
      stroke="#430000"
      stroke-width="2"
    />

    <text
      x="350"
      y="239"
      fill="#ff2020"
      font-family="Arial"
      font-size="16"
      font-weight="bold"
    >
      رقم العضو
    </text>

    <text
      x="530"
      y="239"
      fill="#ffffff"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      #${memberNumber}
    </text>

    <!-- الحالة -->

    <rect
      x="590"
      y="205"
      width="260"
      height="55"
      rx="15"
      fill="#090909"
      stroke="#430000"
      stroke-width="2"
    />

    <circle
      cx="620"
      cy="232"
      r="8"
      fill="${status.color}"
      filter="url(#glow)"
    />

    <text
      x="640"
      y="239"
      fill="#777777"
      font-family="Arial"
      font-size="15"
    >
      الحالة
    </text>

    <text
      x="705"
      y="239"
      fill="${status.color}"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
    >
      ${status.text}
    </text>

    <!-- =================================================
         بطاقات الإحصائيات
    ================================================= -->

    <!-- مدة العضوية -->

    <rect
      x="55"
      y="305"
      width="345"
      height="145"
      rx="22"
      fill="#080808"
      stroke="#420000"
      stroke-width="2"
      filter="url(#shadow)"
    />

    <text
      x="227"
      y="340"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      مدة العضوية
    </text>

    <text
      x="227"
      y="366"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      داخل السيرفر منذ
    </text>

    <text
      x="227"
      y="408"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="25"
      font-weight="bold"
    >
      ${days} يوم و ${hours} ساعة
    </text>

    <!-- الرسائل -->

    <rect
      x="427"
      y="305"
      width="345"
      height="145"
      rx="22"
      fill="#080808"
      stroke="#420000"
      stroke-width="2"
      filter="url(#shadow)"
    />

    <text
      x="599"
      y="340"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      عدد الرسائل
    </text>

    <text
      x="599"
      y="366"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      إجمالي رسائل العضو
    </text>

    <text
      x="599"
      y="414"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="32"
      font-weight="bold"
    >
      ${messages}
    </text>

    <!-- المكالمات -->

    <rect
      x="799"
      y="305"
      width="345"
      height="145"
      rx="22"
      fill="#080808"
      stroke="#420000"
      stroke-width="2"
      filter="url(#shadow)"
    />

    <text
      x="971"
      y="340"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      وقت المكالمات
    </text>

    <text
      x="971"
      y="366"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      إجمالي وقت المكالمات
    </text>

    <text
      x="971"
      y="414"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="21"
      font-weight="bold"
    >
      ${voiceTime}
    </text>

    <!-- =================================================
         معلومات إضافية
    ================================================= -->

    <rect
      x="55"
      y="475"
      width="1089"
      height="105"
      rx="22"
      fill="#070707"
      stroke="#300000"
      stroke-width="2"
    />

    <!-- عمر الحساب -->

    <text
      x="235"
      y="510"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      عمر الحساب
    </text>

    <text
      x="235"
      y="548"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      ${accountAge.number} ${accountAge.text}
    </text>

    <!-- الرتب -->

    <text
      x="600"
      y="510"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      عدد الرتب
    </text>

    <text
      x="600"
      y="548"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      ${roleCount} رتبة
    </text>

    <!-- الترتيب -->

    <text
      x="965"
      y="510"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      ترتيب العضو
    </text>

    <text
      x="965"
      y="548"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      #${memberNumber}
    </text>

    <!-- =================================================
         أسفل البطاقة
    ================================================= -->

    <rect
      x="70"
      y="605"
      width="1060"
      height="3"
      rx="2"
      fill="url(#redLine)"
      filter="url(#glow)"
    />

    <text
      x="600"
      y="645"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="22"
      font-weight="bold"
    >
      NEON • MORE THAN JUST A SERVER
    </text>

    <text
      x="600"
      y="667"
      text-anchor="middle"
      fill="#555555"
      font-family="Arial"
      font-size="12"
    >
      MEMBER DNA SYSTEM
    </text>

  </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

/* =====================================================
   أوامر البوت
===================================================== */

const commands = [
  new SlashCommandBuilder()
    .setName("dna")
    .setDescription(
      "عرض بطاقة تعريفك وإحصائياتك"
    )
].map(command =>
  command.toJSON()
);

/* =====================================================
   تسجيل الأمر
===================================================== */

const rest = new REST({
  version: "10"
}).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log(
      "🔄 جاري تسجيل أمر /dna..."
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
      "✅ تم تسجيل أمر /dna بنجاح."
    );

  } catch (error) {
    console.error(
      "❌ خطأ أثناء تسجيل الأمر:",
      error
    );
  }
}

/* =====================================================
   عند تشغيل البوت
===================================================== */

client.once(
  "ready",
  async () => {
    console.log(
      `✅ تم تشغيل البوت: ${client.user.tag}`
    );

    console.log(
      `🌌 NEON DNA System يعمل الآن.`
    );

    await registerCommands();
  }
);

/* =====================================================
   تسجيل الرسائل
===================================================== */

client.on(
  "messageCreate",
  message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const memberData =
      getMemberData(
        message.guild.id,
        message.author.id
      );

    memberData.messages++;

    saveData();
  }
);

/* =====================================================
   تسجيل دخول وخروج المكالمات
===================================================== */

client.on(
  "voiceStateUpdate",
  (oldState, newState) => {

    if (!newState.guild) return;

    const userId =
      newState.id;

    const guildId =
      newState.guild.id;

    const memberData =
      getMemberData(
        guildId,
        userId
      );

    /* دخل مكالمة */

    if (
      !oldState.channel &&
      newState.channel
    ) {

      memberData.voiceStarted =
        Date.now();

      saveData();

      return;
    }

    /* خرج من المكالمة */

    if (
      oldState.channel &&
      !newState.channel
    ) {

      if (
        memberData.voiceStarted
      ) {

        const seconds =
          Math.floor(
            (
              Date.now() -
              memberData.voiceStarted
            ) / 1000
          );

        memberData.voiceSeconds +=
          Math.max(
            0,
            seconds
          );
      }

      memberData.voiceStarted =
        null;

      saveData();

      return;
    }

    /* انتقل من روم إلى روم */

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

/* =====================================================
   أمر /dna
===================================================== */

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

      if (!interaction.guild) {
        return interaction.reply({
          content:
            "❌ هذا الأمر يعمل داخل السيرفر فقط.",
          ephemeral: true
        });
      }

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

      const attachment =
        new AttachmentBuilder(
          image,
          {
            name:
              `NEON-DNA-${member.user.username}.png`
          }
        );

      await interaction.editReply({
        content:
          `👑 **NEON MEMBER DNA**\n` +
          `📊 بطاقة تعريف **${member.user.username}**`,
        files: [
          attachment
        ]
      });

    } catch (error) {

      console.error(
        "❌ خطأ في أمر /dna:",
        error
      );

      try {

        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.editReply({
            content:
              "❌ حدث خطأ أثناء إنشاء بطاقة العضو."
          });

        } else {

          await interaction.reply({
            content:
              "❌ حدث خطأ أثناء إنشاء بطاقة العضو.",
            ephemeral: true
          });

        }

      } catch {}
    }
  }
);

/* =====================================================
   حفظ البيانات قبل إيقاف البوت
===================================================== */

process.on(
  "SIGINT",
  () => {
    saveData();

    console.log(
      "💾 تم حفظ البيانات."
    );

    process.exit(0);
  }
);

process.on(
  "SIGTERM",
  () => {
    saveData();

    console.log(
      "💾 تم حفظ البيانات."
    );

    process.exit(0);
  }
);

/* =====================================================
   تشغيل البوت
===================================================== */

client.login(TOKEN);
