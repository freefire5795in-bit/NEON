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

// ======================================================
// SETTINGS
// ======================================================

const CLIENT_ID = '1557370938650271824';

const DNA_CHANNEL_ID = '1557391771527553125';

// ======================================================
// OWNER
// ======================================================

const OWNER_ID = '1509551287623094283';

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود.');
  process.exit(1);
}

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

// ======================================================
// DATA
// ======================================================

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

let saveTimer = null;

// ======================================================
// MEMBER DATA
// ======================================================

function getMemberData(guildId, userId) {

  if (!data[guildId]) {
    data[guildId] = {};
  }

  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      messages: 0,
      voiceSeconds: 0,
      voiceStarted: null,
      dnaMessageId: null
    };
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      data[guildId][userId],
      'dnaMessageId'
    )
  ) {
    data[guildId][userId].dnaMessageId = null;
  }

  return data[guildId][userId];
}

// ======================================================
// ALLOWED DNA USERS
// ======================================================

function getAllowedUsers(guildId) {

  if (!data[guildId]) {
    data[guildId] = {};
  }

  if (!data[guildId].allowedDNAUsers) {
    data[guildId].allowedDNAUsers = [];
  }

  return data[guildId].allowedDNAUsers;
}

function isAllowedToWrite(guildId, userId) {

  // الـOwner مسموح له دائمًا
  if (userId === OWNER_ID) {
    return true;
  }

  const allowedUsers =
    getAllowedUsers(guildId);

  return allowedUsers.includes(userId);
}

// ======================================================
// SAVE
// ======================================================

function saveSoon() {

  if (saveTimer) {
    return;
  }

  saveTimer = setTimeout(() => {

    saveTimer = null;

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

  }, 3000);
}

function saveNow() {

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

// ======================================================
// TEXT
// ======================================================

function escapeXML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(value) {

  return Number(value || 0)
    .toLocaleString('en-US');
}

function fitText(text, max) {

  text = String(text || '');

  if (text.length <= max) {
    return text;
  }

  return text.substring(0, max - 3) + '...';
}

// ======================================================
// DATE
// ======================================================

function formatDate(date) {

  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {
    return 'غير معروف';
  }

  const day =
    String(date.getDate()).padStart(2, '0');

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const year =
    date.getFullYear();

  return `${day}/${month}/${year}`;
}

// ======================================================
// ACCOUNT AGE
// ======================================================

function getAccountAge(createdAt) {

  if (!createdAt) {
    return 'غير معروف';
  }

  const now = new Date();

  let months =
    (
      now.getFullYear() -
      createdAt.getFullYear()
    ) * 12 +
    (
      now.getMonth() -
      createdAt.getMonth()
    );

  if (
    now.getDate() <
    createdAt.getDate()
  ) {
    months--;
  }

  months = Math.max(0, months);

  if (months >= 12) {

    const years =
      Math.floor(months / 12);

    const remainingMonths =
      months % 12;

    if (remainingMonths > 0) {
      return `${years} سنة و ${remainingMonths} شهر`;
    }

    return `${years} سنة`;
  }

  if (months > 0) {
    return `${months} شهور`;
  }

  return 'أقل من شهر';
}

// ======================================================
// MEMBERSHIP
// ======================================================

function getMembershipTime(joinedAt) {

  if (!joinedAt) {
    return 'غير معروف';
  }

  const difference =
    Math.max(
      0,
      Date.now() - joinedAt.getTime()
    );

  const totalHours =
    Math.floor(
      difference / 3600000
    );

  const days =
    Math.floor(totalHours / 24);

  const hours =
    totalHours % 24;

  return `${formatNumber(days)} يوم و ${formatNumber(hours)} ساعة`;
}

// ======================================================
// VOICE
// ======================================================

function formatVoiceTime(seconds) {

  seconds =
    Math.max(
      0,
      Math.floor(Number(seconds) || 0)
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

    return `${formatNumber(days)} يوم و ${formatNumber(hours)} ساعة`;

  }

  if (hours > 0) {

    return `${formatNumber(hours)} ساعة و ${formatNumber(minutes)} دقيقة`;

  }

  return `${formatNumber(minutes)} دقيقة`;
}

// ======================================================
// STATUS
// ======================================================

function getStatus(member) {

  const presence =
    member.guild.presences.cache.get(
      member.id
    );

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

// ======================================================
// MEMBER NUMBER
// ======================================================

async function getMemberNumber(
  guild,
  target
) {

  try {

    const members =
      await guild.members.fetch();

    const humans =
      [...members.values()]
        .filter(
          member =>
            !member.user.bot
        )
        .sort(
          (a, b) => {

            const aTime =
              a.joinedTimestamp || Infinity;

            const bTime =
              b.joinedTimestamp || Infinity;

            if (aTime === bTime) {

              return a.id.localeCompare(
                b.id
              );

            }

            return aTime - bTime;
          }
        );

    const index =
      humans.findIndex(
        member =>
          member.id === target.id
      );

    return index >= 0
      ? index + 1
      : 1;

  } catch (error) {

    console.error(
      '❌ خطأ في حساب رقم العضو:',
      error
    );

    return 1;
  }
}

// ======================================================
// AVATAR
// ======================================================

async function getAvatar(member) {

  try {

    const url =
      member.user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true
      });

    const response =
      await fetch(url);

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    const image =
      await sharp(buffer)
        .resize(
          512,
          512,
          {
            fit: 'cover'
          }
        )
        .png()
        .toBuffer();

    return (
      'data:image/png;base64,' +
      image.toString('base64')
    );

  } catch (error) {

    console.error(
      '⚠️ مشكلة في الأفاتار:',
      error
    );

    return null;
  }
}

// ======================================================
// DNA IMAGE
// ======================================================

async function createDNAImage(
  member,
  memberData,
  memberNumber
) {

  const WIDTH = 1400;
  const HEIGHT = 1400;

  const avatar =
    await getAvatar(member);

  const status =
    getStatus(member);

  const name =
    fitText(
      member.displayName ||
      member.user.globalName ||
      member.user.username,
      20
    );

  const username =
    fitText(
      member.user.username,
      27
    );

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
    Number(memberData.messages || 0);

  let voiceSeconds =
    Number(memberData.voiceSeconds || 0);

  if (memberData.voiceStarted) {

    voiceSeconds +=
      Math.floor(
        (
          Date.now() -
          Number(memberData.voiceStarted)
        ) / 1000
      );

  }

  const voice =
    formatVoiceTime(
      voiceSeconds
    );

  const safeName =
    escapeXML(name);

  const safeUsername =
    escapeXML(username);

  const safeID =
    escapeXML(member.user.id);

  function bigBox(
    x,
    y,
    width,
    title,
    subtitle,
    value
  ) {

    return `
      <g>

        <path
          d="
            M ${x + 25} ${y}
            H ${x + width - 25}
            L ${x + width} ${y + 25}
            V ${y + 165}
            L ${x + width - 25} ${y + 190}
            H ${x + 25}
            L ${x} ${y + 165}
            V ${y + 25}
            Z
          "
          fill="#050505"
          stroke="#e51a2a"
          stroke-width="2"
        />

        <text
          x="${x + width / 2}"
          y="${y + 42}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="21"
          font-weight="bold"
          fill="#ff2635"
        >
          ${escapeXML(title)}
        </text>

        <text
          x="${x + width / 2}"
          y="${y + 73}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="14"
          fill="#777"
        >
          ${escapeXML(subtitle)}
        </text>

        <text
          x="${x + width / 2}"
          y="${y + 135}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="${String(value).length > 25 ? 19 : 25}"
          font-weight="bold"
          fill="#f5f5f5"
        >
          ${escapeXML(value)}
        </text>

        <rect
          x="${x + width / 2 - 34}"
          y="${y + 166}"
          width="68"
          height="4"
          rx="2"
          fill="#ff2635"
        />

      </g>
    `;
  }

  function smallBox(
    x,
    y,
    width,
    title,
    value
  ) {

    return `
      <g>

        <path
          d="
            M ${x + 18} ${y}
            H ${x + width - 18}
            L ${x + width} ${y + 18}
            V ${y + 132}
            L ${x + width - 18} ${y + 150}
            H ${x + 18}
            L ${x} ${y + 132}
            V ${y + 18}
            Z
          "
          fill="#050505"
          stroke="#b91423"
          stroke-width="1.8"
        />

        <text
          x="${x + width / 2}"
          y="${y + 38}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="18"
          font-weight="bold"
          fill="#ff2635"
        >
          ${escapeXML(title)}
        </text>

        <text
          x="${x + width / 2}"
          y="${y + 88}"
          text-anchor="middle"
          direction="rtl"
          font-family="Arial, Tahoma, sans-serif"
          font-size="${String(value).length > 20 ? 16 : 22}"
          font-weight="bold"
          fill="#f2f2f2"
        >
          ${escapeXML(value)}
        </text>

        <rect
          x="${x + width / 2 - 28}"
          y="${y + 132}"
          width="56"
          height="4"
          rx="2"
          fill="#ff2635"
        />

      </g>
    `;
  }

  const svg = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${WIDTH}"
    height="${HEIGHT}"
    viewBox="0 0 ${WIDTH} ${HEIGHT}"
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
          offset="55%"
          stop-color="#110000"
        />

        <stop
          offset="100%"
          stop-color="#020202"
        />

      </linearGradient>

      <filter id="redGlow">

        <feGaussianBlur
          stdDeviation="5"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>

      </filter>

      <radialGradient
        id="avatarBorder"
      >

        <stop
          offset="65%"
          stop-color="#090909"
        />

        <stop
          offset="75%"
          stop-color="#ff1728"
        />

        <stop
          offset="85%"
          stop-color="#650009"
        />

        <stop
          offset="100%"
          stop-color="#100000"
        />

      </radialGradient>

    </defs>

    <rect
      width="1400"
      height="1400"
      rx="45"
      fill="url(#background)"
    />

    <path
      d="
        M 30 140
        L 90 105
        H 1310
        L 1370 140
        V 1260
        L 1310 1295
        H 90
        L 30 1260
        Z
      "
      fill="none"
      stroke="#690008"
      stroke-width="8"
    />

    <path
      d="
        M 55 155
        L 90 130
        H 1310
        L 1345 155
      "
      fill="none"
      stroke="#ff1728"
      stroke-width="3"
      filter="url(#redGlow)"
    />

    <text
      x="78"
      y="62"
      font-family="Georgia, serif"
      font-size="48"
      font-weight="bold"
      fill="#ff2837"
    >
      ♛ NEON
    </text>

    <rect
      x="70"
      y="112"
      width="1260"
      height="3"
      fill="#ff1728"
      filter="url(#redGlow)"
    />

    <rect
      x="65"
      y="145"
      width="1270"
      height="255"
      fill="#030303"
      stroke="#72000b"
      stroke-width="1"
    />

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

    ${
      avatar
        ? `
      <defs>

        <clipPath id="avatarClip">

          <circle
            cx="195"
            cy="280"
            r="99"
          />

        </clipPath>

      </defs>

      <image
        href="${avatar}"
        x="96"
        y="181"
        width="198"
        height="198"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"
      />
      `
        : `
      <circle
        cx="195"
        cy="280"
        r="99"
        fill="#111"
      />

      <text
        x="195"
        y="295"
        text-anchor="middle"
        fill="#777"
        font-size="27"
        font-family="Arial, Tahoma, sans-serif"
      >
        NEON
      </text>
      `
    }

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

    <text
      x="335"
      y="250"
      font-family="Arial, Tahoma, sans-serif"
      font-size="40"
      font-weight="bold"
      fill="#f5f5f5"
    >
      ${safeName}
    </text>

    <text
      x="337"
      y="289"
      font-family="Arial, Tahoma, sans-serif"
      font-size="22"
      fill="#888"
    >
      #${safeUsername}
    </text>

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
      y="235"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="31"
      font-weight="bold"
      fill="#ff2635"
    >
      ملف العضو
    </text>

    <text
      x="1025"
      y="272"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="17"
      fill="#ddd"
    >
      بطاقة تعريف العضو
    </text>

    <rect
      x="850"
      y="294"
      width="350"
      height="2"
      fill="#ff2635"
    />

    <text
      x="1025"
      y="337"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="15"
      fill="#777"
    >
      بيانات وإحصائيات العضو
    </text>

    ${bigBox(
      65,
      425,
      395,
      'مدة العضوية',
      'مدة وجود العضو داخل السيرفر',
      membership
    )}

    ${bigBox(
      500,
      425,
      395,
      'عدد الرسائل',
      'إجمالي رسائل العضو',
      `${formatNumber(messages)} رسالة`
    )}

    ${bigBox(
      935,
      425,
      395,
      'وقت المكالمات',
      'إجمالي وقت وجود العضو في الفويس',
      voice
    )}

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

    <rect
      x="65"
      y="1205"
      width="1270"
      height="2"
      fill="#690009"
    />

    <text
      x="700"
      y="1250"
      text-anchor="middle"
      font-family="Georgia, serif"
      font-size="38"
      font-weight="bold"
      fill="#ff2635"
    >
      ♛ NEON
    </text>

    <text
      x="700"
      y="1278"
      text-anchor="middle"
      direction="rtl"
      font-family="Arial, Tahoma, sans-serif"
      font-size="14"
      fill="#777"
    >
      بطاقة العضو • الإحصائيات • البيانات
    </text>

  </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName('dna')
    .setDescription(
      'عرض بطاقة NEON DNA وإحصائيات العضو'
    ),

  new SlashCommandBuilder()
    .setName('allow')
    .setDescription(
      'السماح لعضو بالكتابة في قناة DNA'
    )
    .addUserOption(
      option =>
        option
          .setName('member')
          .setDescription(
            'العضو الذي تريد السماح له'
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('deny')
    .setDescription(
      'منع عضو من الكتابة في قناة DNA'
    )
    .addUserOption(
      option =>
        option
          .setName('member')
          .setDescription(
            'العضو الذي تريد منعه'
          )
          .setRequired(true)
    )

].map(
  command =>
    command.toJSON()
);

// ======================================================
// REGISTER
// ======================================================

const rest =
  new REST({
    version: '10'
  }).setToken(TOKEN);

async function registerCommands() {

  try {

    console.log(
      '🔄 جاري تسجيل أوامر البوت...'
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
      '✅ تم تسجيل الأوامر.'
    );

  } catch (error) {

    console.error(
      '❌ خطأ في تسجيل الأوامر:',
      error
    );

  }
}

// ======================================================
// READY
// ======================================================

client.once(
  'ready',
  async () => {

    console.log(
      `✅ البوت يعمل باسم: ${client.user.tag}`
    );

    console.log(
      `📌 قناة DNA: ${DNA_CHANNEL_ID}`
    );

    console.log(
      `👑 Owner ID: ${OWNER_ID}`
    );

    await registerCommands();

    for (
      const guild
      of client.guilds.cache.values()
    ) {

      for (
        const member
        of guild.members.cache.values()
      ) {

        if (member.user.bot) {
          continue;
        }

        const memberData =
          getMemberData(
            guild.id,
            member.id
          );

        if (member.voice?.channelId) {

          memberData.voiceStarted =
            Date.now();

        } else {

          memberData.voiceStarted =
            null;

        }
      }
    }

    saveNow();
  }
);

// ======================================================
// MESSAGE COUNTER + DNA CHANNEL
// ======================================================

client.on(
  'messageCreate',
  async message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    // قناة DNA
    if (
      message.channel.id ===
      DNA_CHANNEL_ID
    ) {

      // Owner يكتب عادي
      if (
        message.author.id ===
        OWNER_ID
      ) {
        return;
      }

      // الأعضاء المسموح لهم يكتبوا عادي
      if (
        isAllowedToWrite(
          message.guild.id,
          message.author.id
        )
      ) {
        return;
      }

      // أي عضو غير مسموح → حذف الرسالة
      try {

        await message.delete();

      } catch (error) {

        console.error(
          '❌ لم أستطع حذف رسالة DNA:',
          error
        );

      }

      return;
    }

    // عداد الرسائل
    const memberData =
      getMemberData(
        message.guild.id,
        message.author.id
      );

    memberData.messages++;

    saveSoon();
  }
);

// ======================================================
// VOICE COUNTER
// ======================================================

client.on(
  'voiceStateUpdate',
  (
    oldState,
    newState
  ) => {

    if (!newState.guild) {
      return;
    }

    if (newState.member?.user?.bot) {
      return;
    }

    const memberData =
      getMemberData(
        newState.guild.id,
        newState.id
      );

    // دخول فويس
    if (
      !oldState.channelId &&
      newState.channelId
    ) {

      memberData.voiceStarted =
        Date.now();

      saveSoon();

      return;
    }

    // خروج من فويس
    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      if (memberData.voiceStarted) {

        memberData.voiceSeconds +=
          Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                Number(
                  memberData.voiceStarted
                )
              ) / 1000
            )
          );
      }

      memberData.voiceStarted = null;

      saveSoon();

      return;
    }

    // نقل من روم لروم
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
        newState.channelId
    ) {

      if (!memberData.voiceStarted) {

        memberData.voiceStarted =
          Date.now();

      }

      saveSoon();
    }
  }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  'interactionCreate',
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    // ==================================================
    // /ALLOW
    // ==================================================

    if (
      interaction.commandName ===
      'allow'
    ) {

      if (
        interaction.user.id !==
        OWNER_ID
      ) {

        return interaction.reply({
          content:
            '❌ هذا الأمر للـOwner فقط.',
          flags:
            MessageFlags.Ephemeral
        });
      }

      const user =
        interaction.options.getUser(
          'member'
        );

      const allowedUsers =
        getAllowedUsers(
          interaction.guild.id
        );

      if (
        allowedUsers.includes(
          user.id
        )
      ) {

        return interaction.reply({
          content:
            `⚠️ <@${user.id}> مسموح له بالفعل بالكتابة.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      allowedUsers.push(
        user.id
      );

      saveSoon();

      return interaction.reply({
        content:
          `✅ تم السماح لـ <@${user.id}> بالكتابة في قناة الـDNA.`,
        flags:
          MessageFlags.Ephemeral
      });
    }

    // ==================================================
    // /DENY
    // ==================================================

    if (
      interaction.commandName ===
      'deny'
    ) {

      if (
        interaction.user.id !==
        OWNER_ID
      ) {

        return interaction.reply({
          content:
            '❌ هذا الأمر للـOwner فقط.',
          flags:
            MessageFlags.Ephemeral
        });
      }

      const user =
        interaction.options.getUser(
          'member'
        );

      const allowedUsers =
        getAllowedUsers(
          interaction.guild.id
        );

      const index =
        allowedUsers.indexOf(
          user.id
        );

      if (index === -1) {

        return interaction.reply({
          content:
            `⚠️ <@${user.id}> غير مسموح له بالكتابة أصلًا.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      allowedUsers.splice(
        index,
        1
      );

      saveSoon();

      return interaction.reply({
        content:
          `🔴 تم منع <@${user.id}> من الكتابة في قناة الـDNA.`,
        flags:
          MessageFlags.Ephemeral
      });
    }

    // ==================================================
    // /DNA
    // ==================================================

    if (
      interaction.commandName !==
      'dna'
    ) {
      return;
    }

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
        await interaction.guild.members.fetch({
          user:
            interaction.user.id,
          force:
            true
        });

      const memberData =
        getMemberData(
          interaction.guild.id,
          member.id
        );

      // حذف البطاقة القديمة لنفس العضو فقط
      if (
        memberData.dnaMessageId
      ) {

        try {

          const oldMessage =
            await interaction.channel.messages.fetch(
              memberData.dnaMessageId
            );

          if (
            oldMessage &&
            oldMessage.author.id ===
              client.user.id
          ) {

            await oldMessage.delete();
          }

        } catch {}

        memberData.dnaMessageId =
          null;
      }

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

      const newMessage =
        await interaction.fetchReply();

      memberData.dnaMessageId =
        newMessage.id;

      saveSoon();

    } catch (error) {

      console.error(
        '❌ خطأ أثناء إنشاء البطاقة:',
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

// ======================================================
// SHUTDOWN
// ======================================================

process.on(
  'SIGINT',
  () => {

    saveNow();

    process.exit(0);
  }
);

process.on(
  'SIGTERM',
  () => {

    saveNow();

    process.exit(0);
  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '❌ uncaughtException:',
      error
    );

    saveNow();
  }
);

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '❌ unhandledRejection:',
      error
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(TOKEN);
