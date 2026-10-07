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
// الإعدادات
// =========================

const CLIENT_ID = '1557370938650271824';
const DNA_CHANNEL_ID = '1557391771527553125';
const TOKEN = process.env.DISCORD_TOKEN;


// =========================
// البوت
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
// ملف البيانات
// =========================

const DATA_FILE = path.join(__dirname, 'data.json');

let data = {
  messages: {},
  voice: {}
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('❌ خطأ في قراءة data.json:', error);
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
    console.error('❌ خطأ في حفظ data.json:', error);
  }
}

loadData();


// =========================
// تنسيق الأرقام
// =========================

function formatNumber(number) {
  return Number(number || 0).toLocaleString('en-US');
}


// =========================
// مدة زمنية
// =========================

function formatDuration(ms) {
  if (!ms || ms < 0) return '0 ثانية';

  const totalSeconds = Math.floor(ms / 1000);

  const months = Math.floor(totalSeconds / (60 * 60 * 24 * 30));
  const days = Math.floor(
    (totalSeconds % (60 * 60 * 24 * 30)) /
    (60 * 60 * 24)
  );

  const hours = Math.floor(
    (totalSeconds % (60 * 60 * 24)) /
    (60 * 60)
  );

  const minutes = Math.floor(
    (totalSeconds % (60 * 60)) /
    60
  );

  const seconds = totalSeconds % 60;

  const parts = [];

  if (months) parts.push(`${months} شهر`);
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  if (minutes) parts.push(`${minutes} دقيقة`);
  if (seconds || parts.length === 0) {
    parts.push(`${seconds} ثانية`);
  }

  return parts.join(' ');
}


// =========================
// عمر الحساب
// =========================

function getAccountAge(createdTimestamp) {
  return formatDuration(Date.now() - createdTimestamp);
}


// =========================
// حالة العضو
// =========================

function getStatus(member) {
  const presence =
    member.guild.presences.cache.get(member.id);

  const status =
    presence?.status ||
    member.presence?.status ||
    'offline';

  if (status === 'online') {
    return {
      text: 'متصل',
      color: '#32e875'
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

    const humans = [...members.values()]
      .filter(member => !member.user.bot)
      .sort((a, b) => {
        const aTime = a.joinedTimestamp || Infinity;
        const bTime = b.joinedTimestamp || Infinity;

        if (aTime === bTime) {
          return a.id.localeCompare(b.id);
        }

        return aTime - bTime;
      });

    const index = humans.findIndex(
      member => member.id === target.id
    );

    return index >= 0 ? index + 1 : 1;

  } catch (error) {
    console.error(
      '❌ خطأ في حساب رقم العضو:',
      error
    );

    return 1;
  }
}


// =========================
// الأفاتار
// =========================

async function getAvatar(member) {
  try {
    return member.user.displayAvatarURL({
      extension: 'png',
      size: 512,
      forceStatic: true
    });
  } catch {
    return member.user.displayAvatarURL({
      extension: 'png',
      size: 512
    });
  }
}


// =========================
// قص النص
// =========================

function fitText(text, maxLength) {
  text = String(text || '');

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + '...';
}


// =========================
// تنظيف النص للـ SVG
// =========================

function escapeXML(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


// =========================
// بوكس كبير
// =========================

function bigBox(
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
        M ${x + 30} ${y}
        H ${x + width - 30}
        L ${x + width} ${y + 30}
        V ${y + 135}
        L ${x + width - 30} ${y + 165}
        H ${x + 30}
        L ${x} ${y + 135}
        V ${y + 30}
        Z
      "
      fill="#050505"
      stroke="#ff2635"
      stroke-width="2.5"
    />

    <text
      x="${x + 28}"
      y="${y + 48}"
      font-family="Arial, Tahoma, sans-serif"
      font-size="19"
      fill="#777777"
    >${escapeXML(icon)} ${escapeXML(title)}</text>

    <text
      x="${x + 28}"
      y="${y + 110}"
      font-family="Arial, Tahoma, sans-serif"
      font-size="31"
      font-weight="bold"
      fill="#f5f5f5"
    >${escapeXML(value)}</text>
  `;
}


// =========================
// بوكس صغير
// =========================

function smallBox(
  x,
  y,
  width,
  title,
  value
) {
  return `
    <path
      d="
        M ${x + 22} ${y}
        H ${x + width - 22}
        L ${x + width} ${y + 22}
        V ${y + 105}
        L ${x + width - 22} ${y + 127}
        H ${x + 22}
        L ${x} ${y + 105}
        V ${y + 22}
        Z
      "
      fill="#050505"
      stroke="#ff2635"
      stroke-width="2"
    />

    <text
      x="${x + 22}"
      y="${y + 40}"
      font-family="Arial, Tahoma, sans-serif"
      font-size="16"
      fill="#777777"
    >${escapeXML(title)}</text>

    <text
      x="${x + 22}"
      y="${y + 87}"
      font-family="Arial, Tahoma, sans-serif"
      font-size="25"
      font-weight="bold"
      fill="#f5f5f5"
    >${escapeXML(value)}</text>
  `;
}


// =========================
// إنشاء صورة DNA
// =========================

async function createDNAImage(member) {

  const avatar = await getAvatar(member);
  const status = getStatus(member);

  const name = fitText(
    member.displayName ||
    member.user.globalName ||
    member.user.username,
    20
  );

  const username = fitText(
    member.user.username,
    27
  );

  const safeName = escapeXML(name);
  const safeUsername = escapeXML(username);
  const safeID = escapeXML(member.id);

  const memberNumber =
    await getMemberNumber(
      member.guild,
      member
    );

  const membership =
    formatDuration(
      Date.now() - (member.joinedTimestamp || Date.now())
    );

  const accountAge =
    getAccountAge(
      member.user.createdTimestamp
    );

  const joinDate =
    member.joinedAt
      ? member.joinedAt.toLocaleDateString('en-GB')
      : 'غير معروف';

  const accountDate =
    member.user.createdAt
      ? member.user.createdAt.toLocaleDateString('en-GB')
      : 'غير معروف';

  const roles =
    Math.max(
      0,
      member.roles.cache.filter(
        role => role.id !== member.guild.id
      ).size
    );

  const messages =
    data.messages[member.id] || 0;

  const voice =
    data.voice[member.id] || 0;

  const voiceText =
    formatDuration(voice * 1000);


  // ======================================
  // SVG
  // ======================================

  const svg = `
<svg
  width="1400"
  height="1400"
  viewBox="0 0 1400 1400"
  xmlns="http://www.w3.org/2000/svg"
>

  <defs>

    <linearGradient
      id="bg"
      x1="0"
      y1="0"
      x2="0"
      y2="1"
    >
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#020202"/>
    </linearGradient>

    <linearGradient
      id="avatarBorder"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0%" stop-color="#ff2635"/>
      <stop offset="50%" stop-color="#ff1728"/>
      <stop offset="100%" stop-color="#7d0008"/>
    </linearGradient>

    <clipPath id="avatarClip">
      <circle
        cx="195"
        cy="280"
        r="99"
      />
    </clipPath>

    <filter
      id="glow"
      x="-50%"
      y="-50%"
      width="200%"
      height="200%"
    >
      <feGaussianBlur
        stdDeviation="5"
        result="blur"
      />
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

  </defs>


  <!-- ========================= -->
  <!-- الخلفية -->
  <!-- ========================= -->

  <rect
    width="1400"
    height="1400"
    fill="url(#bg)"
  />

  <rect
    x="35"
    y="35"
    width="1330"
    height="1330"
    rx="22"
    fill="none"
    stroke="#ff1728"
    stroke-width="3"
  />

  <rect
    x="50"
    y="50"
    width="1300"
    height="1300"
    rx="18"
    fill="none"
    stroke="#3a080c"
    stroke-width="2"
  />


  <!-- ========================= -->
  <!-- العنوان -->
  <!-- ========================= -->

  <text
    x="70"
    y="105"
    font-family="Arial, Tahoma, sans-serif"
    font-size="38"
    font-weight="bold"
    fill="#ff2635"
  >NEON</text>

  <text
    x="1330"
    y="105"
    text-anchor="end"
    font-family="Arial, Tahoma, sans-serif"
    font-size="18"
    fill="#777777"
  >MEMBER DNA</text>


  <!-- ========================= -->
  <!-- البروفايل العلوي -->
  <!-- ========================= -->

  <path
    d="
      M 95 145
      H 1305
      L 1335 175
      V 370
      L 1305 400
      H 95
      L 65 370
      V 175
      Z
    "
    fill="#050505"
    stroke="#ff2635"
    stroke-width="2.5"
  />


  <!-- ========================= -->
  <!-- الأفاتار
       بدون أي تغيير -->
  <!-- ========================= -->

  <circle
    cx="195"
    cy="280"
    r="112"
    fill="url(#avatarBorder)"
  />

  <circle
    cx="195"
    cy="280"
    r="104"
    fill="#050505"
    stroke="#ff1728"
    stroke-width="3"
  />

  <image
    href="${avatar}"
    x="96"
    y="181"
    width="198"
    height="198"
    preserveAspectRatio="xMidYMid slice"
    clip-path="url(#avatarClip)"
  />


  <!-- ========================= -->
  <!-- نقطة الحالة
       زي ما هي -->
  <!-- ========================= -->

  <circle
    cx="274"
    cy="357"
    r="18"
    fill="#050505"
    stroke="#ff1728"
    stroke-width="3"
  />

  <circle
    cx="274"
    cy="357"
    r="10"
    fill="${status.color}"
  />


  <!-- ========================= -->
  <!-- الاسم + الهاشتاج -->
  <!-- ========================= -->

  <text
    x="335"
    y="250"
    font-family="Arial, Tahoma, sans-serif"
    font-size="40"
    font-weight="bold"
    fill="#f5f5f5"
  >${safeName}</text>

  <text
    x="337"
    y="289"
    font-family="Arial, Tahoma, sans-serif"
    font-size="22"
    fill="#888888"
  >#${safeUsername}</text>


  <!-- ========================= -->
  <!-- ملف العضو -->
  <!-- ========================= -->

  <path
    d="
      M 790 175
      H 1260
      L 1295 210
      V 365
      L 1260 400
      H 790
      L 755 365
      V 210
      Z
    "
    fill="#050505"
    stroke="#ff2635"
    stroke-width="2.5"
  />

  <text
    x="1025"
    y="225"
    text-anchor="middle"
    font-family="Arial, Tahoma, sans-serif"
    font-size="20"
    fill="#777777"
  >ملف العضو</text>

  <text
    x="1025"
    y="285"
    text-anchor="middle"
    font-family="Arial, Tahoma, sans-serif"
    font-size="34"
    font-weight="bold"
    fill="#f5f5f5"
  >NEON PROFILE</text>

  <text
    x="1025"
    y="330"
    text-anchor="middle"
    font-family="Arial, Tahoma, sans-serif"
    font-size="16"
    fill="#777777"
  >DIGITAL MEMBER CARD</text>


  <!-- ========================= -->
  <!-- الإحصائيات الرئيسية -->
  <!-- ========================= -->

  ${bigBox(
    65,
    425,
    395,
    'مدة العضوية',
    membership,
    '◈'
  )}

  ${bigBox(
    500,
    425,
    395,
    'عدد الرسائل',
    formatNumber(messages),
    '✉'
  )}

  ${bigBox(
    935,
    425,
    395,
    'وقت المكالمات',
    voiceText,
    '◉'
  )}


  <!-- ========================= -->
  <!-- الإحصائيات الثانية -->
  <!-- ========================= -->

  ${smallBox(
    65,
    645,
    290,
    'حالة العضو',
    status.text
  )}

  ${smallBox(
    375,
    645,
    290,
    'ترتيب العضو',
    `#${formatNumber(memberNumber)}`
  )}

  ${smallBox(
    685,
    645,
    290,
    'عدد الرتب',
    `${formatNumber(roles)} رتبة`
  )}

  ${smallBox(
    995,
    645,
    335,
    'عمر الحساب',
    accountAge
  )}


  <!-- ========================= -->
  <!-- بيانات العضو -->
  <!-- ========================= -->

  ${smallBox(
    65,
    825,
    400,
    'اسم العضو',
    name
  )}

  ${smallBox(
    500,
    825,
    400,
    'تاريخ الانضمام',
    joinDate
  )}

  ${smallBox(
    935,
    825,
    395,
    'تاريخ إنشاء الحساب',
    accountDate
  )}


  <!-- ========================= -->
  <!-- البيانات السفلية -->
  <!-- ========================= -->

  ${smallBox(
    65,
    1005,
    600,
    'معرّف العضو',
    safeID
  )}

  ${smallBox(
    700,
    1005,
    630,
    'اسم المستخدم',
    safeUsername
  )}


  <!-- ========================= -->
  <!-- الفوتر -->
  <!-- ========================= -->

  <line
    x1="65"
    y1="1190"
    x2="1330"
    y2="1190"
    stroke="#3a080c"
    stroke-width="2"
  />

  <text
    x="65"
    y="1235"
    font-family="Arial, Tahoma, sans-serif"
    font-size="18"
    fill="#777777"
  >NEON • MEMBER INFORMATION SYSTEM</text>

  <text
    x="1330"
    y="1235"
    text-anchor="end"
    font-family="Arial, Tahoma, sans-serif"
    font-size="18"
    fill="#ff2635"
  >ELZRAZIR</text>

</svg>
`;


  // =========================
  // تحويل SVG إلى PNG
  // =========================

  const outputPath = path.join(
    __dirname,
    `dna-${member.id}.png`
  );

  await sharp(
    Buffer.from(svg)
  )
    .png()
    .toFile(outputPath);

  return outputPath;
}


// =========================
// أوامر البوت
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription('عرض بطاقة معلومات العضو')
];


// =========================
// تسجيل الأمر
// =========================

const rest = new REST({
  version: '10'
}).setToken(TOKEN);

(async () => {
  try {

    console.log('🔄 تسجيل أوامر البوت...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands.map(
          command => command.toJSON()
        )
      }
    );

    console.log('✅ تم تسجيل الأوامر');

  } catch (error) {
    console.error(
      '❌ خطأ في تسجيل الأوامر:',
      error
    );
  }
})();


// =========================
// تشغيل البوت
// =========================

client.once('ready', () => {

  console.log(
    `✅ تم تسجيل الدخول باسم ${client.user.tag}`
  );

  client.user.setActivity(
    'ELZRAZIR',
    {
      type: 0
    }
  );

});


// =========================
// الرسائل
// =========================

client.on(
  'messageCreate',
  message => {

    if (message.author.bot) return;

    if (!message.guild) return;

    data.messages[message.author.id] =
      (data.messages[message.author.id] || 0) + 1;

    saveData();
  }
);


// =========================
// الصوت
// =========================

const voiceJoinTimes = new Map();

client.on(
  'voiceStateUpdate',
  (oldState, newState) => {

    const userId = newState.id;

    // دخل روم صوتي
    if (!oldState.channelId && newState.channelId) {

      voiceJoinTimes.set(
        userId,
        Date.now()
      );

      return;
    }

    // خرج من روم صوتي
    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      const joinedAt =
        voiceJoinTimes.get(userId);

      if (joinedAt) {

        const seconds =
          Math.floor(
            (Date.now() - joinedAt) / 1000
          );

        data.voice[userId] =
          (data.voice[userId] || 0) +
          seconds;

        voiceJoinTimes.delete(userId);

        saveData();
      }
    }
  }
);


// =========================
// أمر /dna
// =========================

client.on(
  'interactionCreate',
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName !== 'dna') {
      return;
    }

    try {

      if (
        interaction.channelId !==
        DNA_CHANNEL_ID
      ) {
        return interaction.reply({
          content:
            '❌ لا يمكنك استخدام هذا الأمر في هذه القناة.',
          flags: MessageFlags.Ephemeral
        });
      }


      const member =
        await interaction.guild.members.fetch({
          user: interaction.user.id,
          force: true
        });


      await interaction.deferReply();


      const imagePath =
        await createDNAImage(member);


      const attachment =
        new AttachmentBuilder(
          imagePath,
          {
            name: 'NEON-DNA.png'
          }
        );


      await interaction.editReply({
        files: [attachment]
      });


      // حذف الملف بعد الإرسال
      setTimeout(() => {

        try {

          if (
            fs.existsSync(imagePath)
          ) {
            fs.unlinkSync(imagePath);
          }

        } catch (error) {
          console.error(
            '❌ خطأ في حذف الصورة:',
            error
          );
        }

      }, 5000);

    } catch (error) {

      console.error(
        '❌ خطأ في أمر DNA:',
        error
      );

      const reply = {
        content:
          '❌ حصل خطأ أثناء إنشاء بطاقة العضو.'
      };

      if (interaction.deferred) {

        await interaction.editReply(
          reply
        ).catch(() => {});

      } else if (!interaction.replied) {

        await interaction.reply({
          ...reply,
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
);


// =========================
// إيقاف البوت
// =========================

process.on(
  'SIGINT',
  () => {

    console.log(
      '🛑 جاري إيقاف البوت...'
    );

    saveData();

    client.destroy();

    process.exit(0);
  }
);


process.on(
  'SIGTERM',
  () => {

    console.log(
      '🛑 جاري إيقاف البوت...'
    );

    saveData();

    client.destroy();

    process.exit(0);
  }
);


// =========================
// تسجيل الدخول
// =========================

client.login(TOKEN);
