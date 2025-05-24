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

let currentAnswer = null;
let isPlaying = false;

// Slash command /help
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Hiện danh sách lệnh và mô tả'),
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
  currentAnswer = brainrotData[randomImage].toLowerCase();
  channel.send('🧠 **Đoán nhân vật trong ảnh!**');
  channel.send({ files: [path.join(__dirname, 'images', randomImage)] });
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();

  if (msg === '!brainrot') {
    if (isPlaying) return message.reply('🧠 Đang chơi rồi! Dùng `!stopbrainrot` để dừng.');
    isPlaying = true;
    sendNextImage(message.channel);
  }

  else if (msg === '!stopbrainrot') {
    if (!isPlaying) return message.reply('🛑 Không có game nào đang diễn ra.');
    isPlaying = false;
    currentAnswer = null;
    message.reply('🛑 Đã dừng trò chơi.');
  }

  else if (msg === '!listbrainrot') {
    const list = Object.values(brainrotData).join(', ');
    message.reply(`📃 Danh sách đáp án có thể: \n${list}`);
  }

  else if (isPlaying && currentAnswer) {
    if (msg === currentAnswer.toLowerCase()) {
      await message.reply('✅ Đúng rồi! Tiếp theo nè...');
      sendNextImage(message.channel); // Gửi ảnh tiếp theo
    } else {
      message.reply('❌ Sai rồi! Dùng `!listbrainrot` để xem đáp án nha.');
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'help') {
    await interaction.reply({
      content: `📖 **Danh sách lệnh:**\n\n` +
        `• \`!brainrot\` → Gửi ảnh để bạn đoán nhân vật\n` +
        `• \`!listbrainrot\` → Hiện danh sách đáp án có thể\n` +
        `• \`!stopbrainrot\` → Dừng game hiện tại`,
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);
