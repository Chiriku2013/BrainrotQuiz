const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const brainrotData = JSON.parse(fs.readFileSync('brainrot.json', 'utf-8'));
const imageNames = Object.keys(brainrotData);

let isPlaying = {};
let currentAnswer = {};
let answerStartTime = {};
let userStats = {}; // Lưu đúng/sai liên tiếp cho từng người

// Slash command
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Hiện danh sách lệnh và mô tả'),
  new SlashCommandBuilder().setName('play').setDescription('Bắt đầu chơi Brainrot'),
  new SlashCommandBuilder().setName('stop').setDescription('Dừng trò chơi Brainrot'),
  new SlashCommandBuilder().setName('list').setDescription('Xem danh sách đáp án')
];

(async () => {
  try {
    console.log('🔄 Đăng slash command...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash command đã sẵn sàng!');
  } catch (err) {
    console.error(err);
  }
})();

client.on('ready', () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
});

function sendNextImage(channel) {
  const randomImage = imageNames[Math.floor(Math.random() * imageNames.length)];
  const answer = brainrotData[randomImage].toLowerCase();
  currentAnswer[channel.id] = answer;
  answerStartTime[channel.id] = Date.now();

  channel.send('🧠 **Đoán nhân vật trong ảnh!**');
  channel.send({ files: [path.join(__dirname, 'images', randomImage)] });
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const channelId = message.channel.id;
  const msg = message.content.toLowerCase();

  // Slash-like support (giữ lại lệnh cũ cho người quen)
  if (msg === '!brainrot') {
    if (isPlaying[channelId]) return message.reply('🧠 Đang chơi rồi! Dùng `!stopbrainrot` để dừng.');
    isPlaying[channelId] = true;
    sendNextImage(message.channel);
  } else if (msg === '!stopbrainrot') {
    isPlaying[channelId] = false;
    currentAnswer[channelId] = null;
    message.reply('🛑 Đã dừng trò chơi.');
  } else if (msg === '!listbrainrot') {
    const list = Object.values(brainrotData).join(', ');
    message.reply(`📃 Danh sách đáp án có thể: \n${list}`);
  }

  // Xử lý trả lời
  else if (isPlaying[channelId] && currentAnswer[channelId]) {
    const guess = msg.trim().toLowerCase();
    const correct = guess === currentAnswer[channelId];
    const userId = message.author.id;

    if (!userStats[userId]) userStats[userId] = { correctStreak: 0, wrongStreak: 0 };

    if (correct) {
      const time = ((Date.now() - answerStartTime[channelId]) / 1000).toFixed(2);
      message.reply(`✅ <@${userId}> đã trả lời đúng trong vòng ${time} giây!`);

      userStats[userId].correctStreak++;
      userStats[userId].wrongStreak = 0;

      if (userStats[userId].correctStreak === 10) {
        message.channel.send(`✨ Level Up <@${userId}> – Đạt Danh Hiệu **Trùm Não Tươi**!`);
      }

      sendNextImage(message.channel);
    } else {
      userStats[userId].wrongStreak++;
      userStats[userId].correctStreak = 0;

      if (userStats[userId].wrongStreak === 5) {
        message.channel.send(`💀 <@${userId}> Đạt Danh Hiệu **Chưa Thối Não**, hãy cố gắng trả lời đúng nhé!`);
      } else {
        // Gợi ý trả lời
        const firstLetter = currentAnswer[channelId][0].toUpperCase();
        const length = currentAnswer[channelId].length;
        message.reply(`❌ Sai rồi! Gợi ý: bắt đầu bằng **${firstLetter}**, gồm **${length} chữ cái**. Dùng \`/list\` nếu muốn xem tất cả đáp án.`);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const channel = interaction.channel;
  const channelId = channel.id;

  if (!isPlaying[channelId]) isPlaying[channelId] = false;

  if (interaction.commandName === 'play') {
    if (isPlaying[channelId]) return interaction.reply('🧠 Đang chơi rồi! Dùng `/stop` để dừng.');
    isPlaying[channelId] = true;
    await interaction.reply('🧠 Bắt đầu trò chơi Brainrot!');
    sendNextImage(channel);
  }
  else if (interaction.commandName === 'stop') {
    isPlaying[channelId] = false;
    currentAnswer[channelId] = null;
    await interaction.reply('🛑 Đã dừng trò chơi.');
  }
  else if (interaction.commandName === 'list') {
    const list = Object.values(brainrotData).join(', ');
    await interaction.reply(`📃 Danh sách đáp án có thể: \n${list}`);
  }
  else if (interaction.commandName === 'help') {
    await interaction.reply({
      content: `📖 **Danh sách lệnh:**\n\n` +
        `• \`/play\` hoặc \`!brainrot\` → Gửi ảnh để đoán\n` +
        `• \`/list\` hoặc \`!listbrainrot\` → Danh sách đáp án\n` +
        `• \`/stop\` hoặc \`!stopbrainrot\` → Dừng game hiện tại`,
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);
