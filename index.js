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
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ توكن البوت غير موجود في إعدادات الاستضافة.");
  process.exit(1);
}

/* =====================================================
   تشغيل البوت
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
  } catch (error) {
    console.error("⚠️ تعذر قراءة ملف البيانات.");
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
      "❌ حدث خطأ أثناء حفظ البيانات:",
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

function getMembershipParts(date) {
  if (!date) {
    return {
      days: 0,
      hours: 0
    };
  }

  const difference = Math.max(
    0,
    Date.now() - date.getTime()
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
   تنسيق وقت المكالمات
===================================================== */

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
    return `${days} يوم - ${hours} ساعة`;
  }

  if (hours > 0) {
    return `${hours} ساعة - ${minutes} دقيقة`;
  }

  return `${minutes} دقيقة`;
}

/* =====================================================
   عمر حساب ديسكورد
===================================================== */

function getAccountAge(date) {
  if (!date) {
    return {
      value: 0,
      unit: "يوم"
    };
  }

  const difference = Math.max(
    0,
    Date.now() - date.getTime()
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
      value: years,
      unit: years === 1 ? "سنة" : "سنوات"
    };
  }

  if (months > 0) {
    return {
      value: months,
      unit: months === 1 ? "شهر" : "شهور"
    };
  }

  return {
    value: days,
    unit: "يوم"
  };
}

/* =====================================================
   رقم العضو في السيرفر
===================================================== */

async function getMemberNumber(
  guild,
  targetMember
) {
  try {
    const members =
      await guild.members.fetch();

    const humanMembers =
      members
        .filter(member => !member.user.bot)
        .sort((a, b) => {
          const first =
            a.joinedTimestamp || Infinity;

          const second =
            b.joinedTimestamp || Infinity;

          return first - second;
        });

    const list =
      [...humanMembers.values()];

    const index =
      list.findIndex(
        member =>
          member.id === targetMember.id
      );

    if (index === -1) {
      return list.length;
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
   حماية النص
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
   إنشاء صورة DNA
===================================================== */

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {
  const width = 1000;
  const height = 600;

  /* ---------------------------------------------
     صورة العضو
  --------------------------------------------- */

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
    avatarBuffer = null;
  }

  const avatarBase64 =
    avatarBuffer
      ? Buffer.from(
          avatarBuffer
        ).toString("base64")
      : "";

  /* ---------------------------------------------
     مدة العضوية
  --------------------------------------------- */

  const membership =
    getMembershipParts(
      member.joinedAt
    );

  const days =
    membership.days;

  const hours =
    membership.hours;

  /* ---------------------------------------------
     وقت المكالمات
  --------------------------------------------- */

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

  /* ---------------------------------------------
     الرسائل
  --------------------------------------------- */

  const messages =
    memberData.messages.toLocaleString(
      "en-US"
    );

  /* ---------------------------------------------
     اسم العضو
  --------------------------------------------- */

  const username =
    escapeXML(
      member.user.username
    );

  /* ---------------------------------------------
     عمر الحساب
  --------------------------------------------- */

  const account =
    getAccountAge(
      member.user.createdAt
    );

  /* ---------------------------------------------
     عدد الرتب
  --------------------------------------------- */

  const roleCount =
    Math.max(
      0,
      member.roles.cache.size - 1
    );

  /* ---------------------------------------------
     الحالة
  --------------------------------------------- */

  const status =
    getMemberStatus(member);

  /* ---------------------------------------------
     صورة العضو داخل الدائرة
  --------------------------------------------- */

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

  /* =================================================
     تصميم الصورة
  ================================================= */

  const svg = `
  <svg
    width="${width}"
    height="${height}"
    viewBox="0 0 1000 600"
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
          stop-color="#020202"
        />

        <stop
          offset="50%"
          stop-color="#100202"
        />

        <stop
          offset="100%"
          stop-color="#030303"
        />
      </linearGradient>

      <!-- الخط الأحمر -->

      <linearGradient
        id="redLine"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset="0%"
          stop-color="#550000"
        />

        <stop
          offset="50%"
          stop-color="#ff2020"
        />

        <stop
          offset="100%"
          stop-color="#550000"
        />
      </linearGradient>

      <!-- توهج -->

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

      <!-- ظل -->

      <filter id="shadow">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="7"
          flood-color="#000000"
          flood-opacity="0.7"
        />
      </filter>

    </defs>

    <!-- =================================================
         الخلفية
    ================================================= -->

    <rect
      width="1000"
      height="600"
      rx="40"
      fill="url(#background)"
    />

    <circle
      cx="900"
      cy="80"
      r="190"
      fill="#a00000"
      opacity="0.08"
    />

    <circle
      cx="30"
      cy="540"
      r="200"
      fill="#ff0000"
      opacity="0.035"
    />

    <!-- الإطار -->

    <rect
      x="24"
      y="24"
      width="952"
      height="552"
      rx="32"
      fill="none"
      stroke="#720000"
      stroke-width="2"
    />

    <!-- =================================================
         العنوان
    ================================================= -->

    <text
      x="500"
      y="62"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="30"
      font-weight="bold"
    >
      نيون • تعريف العضو
    </text>

    <text
      x="500"
      y="89"
      text-anchor="middle"
      fill="#666666"
      font-family="Arial"
      font-size="14"
    >
      ملف معلومات العضو
    </text>

    <!-- =================================================
         الصورة
    ================================================= -->

    <circle
      cx="135"
      cy="135"
      r="96"
      fill="#080000"
      stroke="#430000"
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

    <!-- =================================================
         اسم العضو
    ================================================= -->

    <text
      x="270"
      y="120"
      fill="#ffffff"
      font-family="Arial"
      font-size="31"
      font-weight="bold"
    >
      ${username}
    </text>

    <text
      x="270"
      y="148"
      fill="#777777"
      font-family="Arial"
      font-size="15"
    >
      اسم العضو
    </text>

    <!-- رقم العضو -->

    <text
      x="270"
      y="176"
      fill="#ff2020"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
    >
      رقم العضو
    </text>

    <text
      x="370"
      y="176"
      fill="#ffffff"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
    >
      ${memberNumber}
    </text>

    <!-- الحالة -->

    <circle
      cx="275"
      cy="201"
      r="6"
      fill="${status.color}"
    />

    <text
      x="290"
      y="206"
      fill="#888888"
      font-family="Arial"
      font-size="14"
    >
      الحالة
    </text>

    <text
      x="350"
      y="206"
      fill="${status.color}"
      font-family="Arial"
      font-size="14"
      font-weight="bold"
    >
      ${status.text}
    </text>

    <!-- =================================================
         الكارت الأول
    ================================================= -->

    <rect
      x="50"
      y="230"
      width="285"
      height="155"
      rx="22"
      fill="#090909"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="75"
      y="262"
      fill="#ff2020"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      مدة العضوية
    </text>

    <text
      x="75"
      y="290"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      داخل السيرفر منذ
    </text>

    <!-- الأيام -->

    <text
      x="75"
      y="327"
      fill="#ffffff"
      font-family="Arial"
      font-size="25"
      font-weight="bold"
    >
      ${days}
    </text>

    <text
      x="125"
      y="327"
      fill="#aaaaaa"
      font-family="Arial"
      font-size="20"
    >
      يوم
    </text>

    <!-- الساعات -->

    <text
      x="75"
      y="356"
      fill="#ffffff"
      font-family="Arial"
      font-size="22"
      font-weight="bold"
    >
      ${hours}
    </text>

    <text
      x="120"
      y="356"
      fill="#aaaaaa"
      font-family="Arial"
      font-size="18"
    >
      ساعة
    </text>

    <!-- =================================================
         الكارت الثاني
    ================================================= -->

    <rect
      x="357"
      y="230"
      width="285"
      height="155"
      rx="22"
      fill="#090909"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="382"
      y="262"
      fill="#ff2020"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      عدد الرسائل
    </text>

    <text
      x="382"
      y="290"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      إجمالي رسائل العضو
    </text>

    <text
      x="382"
      y="337"
      fill="#ffffff"
      font-family="Arial"
      font-size="30"
      font-weight="bold"
    >
      ${messages}
    </text>

    <text
      x="382"
      y="365"
      fill="#777777"
      font-family="Arial"
      font-size="13"
    >
      رسالة
    </text>

    <!-- =================================================
         الكارت الثالث
    ================================================= -->

    <rect
      x="665"
      y="230"
      width="285"
      height="155"
      rx="22"
      fill="#090909"
      stroke="#3d0909"
      stroke-width="1.5"
      filter="url(#shadow)"
    />

    <text
      x="690"
      y="262"
      fill="#ff2020"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      وقت المكالمات
    </text>

    <text
      x="690"
      y="290"
      fill="#777777"
      font-family="Arial"
      font-size="14"
    >
      إجمالي وقت المكالمات
    </text>

    <text
      x="690"
      y="337"
      fill="#ffffff"
      font-family="Arial"
      font-size="23"
      font-weight="bold"
    >
      ${voiceTime}
    </text>

    <!-- =================================================
         الخط الفاصل
    ================================================= -->

    <rect
      x="50"
      y="410"
      width="900"
      height="3"
      rx="2"
      fill="url(#redLine)"
    />

    <!-- =================================================
         المعلومات الإضافية
    ================================================= -->

    <!-- عمر الحساب -->

    <text
      x="75"
      y="448"
      fill="#777777"
      font-family="Arial"
      font-size="13"
    >
      عمر الحساب
    </text>

    <text
      x="75"
      y="475"
      fill="#ffffff"
      font-family="Arial"
      font-size="17"
      font-weight="bold"
    >
      ${account.value}
    </text>

    <text
      x="125"
      y="475"
      fill="#aaaaaa"
      font-family="Arial"
      font-size="15"
    >
      ${account.unit}
    </text>

    <!-- عدد الرتب -->

    <text
      x="500"
      y="448"
      text-anchor="middle"
      fill="#777777"
      font-family="Arial"
      font-size="13"
    >
      عدد الرتب
    </text>

    <text
      x="500"
      y="475"
      text-anchor="middle"
      fill="#ffffff"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      ${roleCount}
    </text>

    <!-- رقم العضو -->

    <text
      x="925"
      y="448"
      text-anchor="end"
      fill="#777777"
      font-family="Arial"
      font-size="13"
    >
      ترتيب العضو
    </text>

    <text
      x="925"
      y="475"
      text-anchor="end"
      fill="#ff2020"
      font-family="Arial"
      font-size="18"
      font-weight="bold"
    >
      رقم ${memberNumber}
    </text>

    <!-- =================================================
         أسفل الصورة
    ================================================= -->

    <text
      x="500"
      y="525"
      text-anchor="middle"
      fill="#ff2020"
      font-family="Arial"
      font-size="19"
      font-weight="bold"
    >
      عصابة نيون
    </text>

    <text
      x="500"
      y="550"
      text-anchor="middle"
      fill="#555555"
      font-family="Arial"
      font-size="12"
    >
      نظام تعريف أعضاء السيرفر
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
   أمر /dna
===================================================== */

const commands = [
  new SlashCommandBuilder()
    .setName("dna")
    .setDescription(
      "عرض بطاقة تعريف العضو وإحصائياته"
    )
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription(
          "اختر العضو الذي تريد عرض بطاقته"
        )
        .setRequired(false)
    )
].map(command =>
  command.toJSON()
);

/* =====================================================
   عند تشغيل البوت
===================================================== */

client.once(
  "ready",
  async () => {

    console.log(
      `✅ تم تسجيل الدخول باسم ${client.user.tag}`
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    try {

      console.log(
        "⏳ جاري تسجيل أمر /dna..."
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
        "❌ حدث خطأ أثناء تسجيل الأمر:",
        error
      );
    }
  }
);

/* =====================================================
   حساب الرسائل
===================================================== */

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

/* =====================================================
   حساب وقت المكالمات
===================================================== */

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

/* =====================================================
   أوامر التفاعل
===================================================== */

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

      /* العضو المطلوب */

      const selectedUser =
        interaction.options.getUser(
          "member"
        ) || interaction.user;

      /* جلب العضو */

      const member =
        await interaction.guild.members
          .fetch(
            selectedUser.id
          )
          .catch(() => null);

      if (!member) {

        return interaction.editReply(
          "❌ هذا العضو غير موجود في السيرفر."
        );
      }

      /* رقم العضو */

      const memberNumber =
        await getMemberNumber(
          interaction.guild,
          member
        );

      /* بيانات العضو */

      const memberData =
        getMemberData(
          interaction.guild.id,
          selectedUser.id
        );

      /* إنشاء الصورة */

      const image =
        await createDNAImage(
          member,
          memberData,
          memberNumber
        );

      /* الصورة المرفقة */

      const attachment =
        new AttachmentBuilder(
          image,
          {
            name: "بطاقة-العضو.png"
          }
        );

      await interaction.editReply({
        files: [attachment]
      });

    } catch (error) {

      console.error(
        "❌ حدث خطأ في أمر DNA:",
        error
      );

      if (interaction.deferred) {

        await interaction
          .editReply(
            "❌ حدث خطأ أثناء إنشاء بطاقة العضو."
          )
          .catch(() => {});

      } else {

        await interaction
          .reply({
            content:
              "❌ حدث خطأ أثناء تنفيذ الأمر.",
            ephemeral: true
          })
          .catch(() => {});
      }
    }
  }
);

/* =====================================================
   معالجة الأخطاء
===================================================== */

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ خطأ غير معالج:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {

    console.error(
      "❌ خطأ في البرنامج:",
      error
    );
  }
);

/* =====================================================
   تشغيل تسجيل الدخول
===================================================== */

console.log(
  "⏳ جاري الاتصال بديسكورد..."
);

client.login(TOKEN);
