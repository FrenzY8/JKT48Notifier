
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

// TOKEN
const BOT_TOKEN = 'BOT_TOKEN_HERE!';
const url_idn = 'https://idnjkt48.vercel.app/api/jkt48-idn'; // My APi (free)
const url_sr = 'https://idnjkt48.vercel.app/api/jkt48-sr'; // My APi (free)
const configPath = './data/server.json'; // Server Config

let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
} else {
  fs.writeFileSync(configPath, JSON.stringify({ guilds: {} }, null, 2));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });
const streamerMessages = {};

const sendDiscordEmbed = async (channel, embed) => {
  try {
    const message = await channel.send({ embeds: [embed] });
    return message.id;
  } catch (error) {
    console.error('Error sending embed message:', error);
  }
};

// Function to fetch stream data
const getStreamData = async (url) => {
  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      const data = response.data;
      return Array.isArray(data) ? data : null;
    } else {
      console.error(`Failed to fetch data: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching stream data:', error);
    return null;
  }
};

// Function to create Discord embed for IDN data
const createDiscordEmbedIdn = (streamerData) => {
  const { user, image, title, embed_live } = streamerData;
  const streamerName = user.name;
  return {
    title: `${streamerName} is live on IDN!`,
    description: `**Title:** ${title}\n**[Watch Live](${embed_live})**\n[Full Live Website](https://jkt48-live.vercel.app)`,
    color: 0x00bfff,
    image: { url: image },
  };
};

// Function to create Discord embed for SR data
const createDiscordEmbedSr = (streamerData) => {
  const { main_name, image, follower_num, streaming_url_list, view_num } = streamerData;
  return {
    title: `${main_name} is live on Showroom!`,
    description: `**Followers:** ${follower_num}\n**Viewers:** ${view_num}\n**[Watch Live](${streaming_url_list[0].url})**\n[Full Live Website](https://jkt48-live.vercel.app)`,
    color: 0xff69b4,
    image: { url: image },
  };
};

client.once('ready', async () => {
  console.log(`${client.user.tag} is online!`);
  client.user.setPresence({
    activities: [
      {
        name: 'member stream!',
        type: 'WATCHING',
      },
    ],
    status: 'online',
  });

  console.log('Rich Presence activity set!');

  for (const guildId in config.guilds) {
    const guildConfig = config.guilds[guildId];

    if (guildConfig && guildConfig.notifChannel) {
      const channel = client.channels.cache.get(guildConfig.notifChannel);

      if (channel) {
        let previousStreamersIdn = {};
        let previousStreamersSr = {};

        setInterval(async () => {
          const currentDataIdn = await getStreamData(url_idn);
          const currentDataSr = await getStreamData(url_sr);

          // Handle IDN streams
          if (!currentDataIdn) {
            if (Object.keys(previousStreamersIdn).length > 0) {
              for (const streamer in previousStreamersIdn) {
                await channel.send(`**${streamer}** has ended their stream on IDN.`);
              }
              previousStreamersIdn = {};
            }
          } else {
            const currentStreamersIdn = Object.fromEntries(
              currentDataIdn.map((streamer) => [streamer.user.name, streamer])
            );

            // New streams
            for (const [name, data] of Object.entries(currentStreamersIdn)) {
              if (!previousStreamersIdn[name]) {
                const embed = createDiscordEmbedIdn(data);
                const messageId = await sendDiscordEmbed(channel, embed);
                streamerMessages[name] = messageId;
              }
            }

            // Ended streams
            for (const name in previousStreamersIdn) {
              if (!currentStreamersIdn[name]) {
                await channel.send(`**${name}** has ended their stream on IDN.`);
                delete streamerMessages[name];
              }
            }

            previousStreamersIdn = currentStreamersIdn;
          }

          // Handle SR streams
          if (!currentDataSr) {
            if (Object.keys(previousStreamersSr).length > 0) {
              for (const streamer in previousStreamersSr) {
                await channel.send(`**${streamer}** has ended their stream on Showroom.`);
              }
              previousStreamersSr = {};
            }
          } else {
            const currentStreamersSr = Object.fromEntries(
              currentDataSr.map((streamer) => [streamer.main_name, streamer])
            );

            // New streams
            for (const [name, data] of Object.entries(currentStreamersSr)) {
              if (!previousStreamersSr[name]) {
                const embed = createDiscordEmbedSr(data);
                const messageId = await sendDiscordEmbed(channel, embed);
                streamerMessages[name] = messageId;
              }
            }

            // Ended streams
            for (const name in previousStreamersSr) {
              if (!currentStreamersSr[name]) {
                await channel.send(`**${name}** has ended their stream on Showroom.`);
                delete streamerMessages[name];
              }
            }

            previousStreamersSr = currentStreamersSr;
          }
        }, 40000); // Check every 40 seconds
      }
    }
  }
});

client.login(BOT_TOKEN);
