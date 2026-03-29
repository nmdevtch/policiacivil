require("dotenv").config();
const fs = require("fs");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const config = require("./config.json");

// 🌐 Web server (Render + UptimeRobot)
const app = express();
app.get("/", (req, res) => res.send("Bot Online 🚔"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Web server ativo"));

// 🤖 Cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel]
});

// ✅ CORRIGIDO (sem warning)
client.once("clientReady", (client) => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

// 📂 Banco de dados seguro
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync("./database.json"));
  } catch {
    return { usuarios: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync("./database.json", JSON.stringify(data, null, 2));
}

// 📥 RECEBER FORMULÁRIO
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== config.canais.formulario) return;

  const nome = message.content.match(/Nome:\s*(.*)/i)?.[1];
  const id = message.content.match(/ID:\s*(.*)/i)?.[1];
  const telefone = message.content.match(/Telefone:\s*(.*)/i)?.[1];
  const recrutador = message.content.match(/Recrutador:\s*(.*)/i)?.[1];

  if (!nome || !id) {
    return message.reply("❌ Use o formato:\nNome:\nID:\nTelefone:\nRecrutador:");
  }

  const db = loadDB();

  db.usuarios.push({
    discordId: message.author.id,
    nome,
    passaporte: id,
    telefone,
    recrutador,
    status: "EM_ANALISE",
    cargo: "Visitante"
  });

  saveDB(db);

  const canalAnalise = await client.channels.fetch(config.canais.analise);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aprovar_${message.author.id}`)
      .setLabel("✅ Aprovar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reprovar_${message.author.id}`)
      .setLabel("❌ Reprovar")
      .setStyle(ButtonStyle.Danger)
  );

  await canalAnalise.send({
    content: `
📥 NOVA CANDIDATURA

👤 Nome: ${nome}
🆔 ID: ${id}
📞 Telefone: ${telefone || "N/A"}
🧑‍💼 Recrutador: ${recrutador || "N/A"}
    `,
    components: [row]
  });

  message.reply("📨 Enviado para análise!");
});

// 🎯 BOTÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [acao, userId] = interaction.customId.split("_");

  const db = loadDB();
  const userData = db.usuarios.find(u => u.discordId === userId);

  if (!userData) {
    return interaction.reply({ content: "❌ Usuário não encontrado.", ephemeral: true });
  }

  const membro = await interaction.guild.members.fetch(userId);

  // ✅ APROVAR
  if (acao === "aprovar") {
    await membro.roles.remove(config.cargos.visitante).catch(() => {});
    await membro.roles.add(config.cargos.aluno).catch(() => {});

    await membro.setNickname(`[AL] ${userData.nome} | ${userData.passaporte}`).catch(() => {});

    userData.status = "APROVADO";
    userData.cargo = "Aluno";

    saveDB(db);

    await client.channels.fetch(config.canais.aprovados)
      .then(c => c.send(`✅ ${userData.nome} | ${userData.passaporte} aprovado.`));

    await client.channels.fetch(config.canais.interno)
      .then(c => c.send(`
📁 REGISTRO INTERNO

👤 Nome: ${userData.nome}
🆔 ID: ${userData.passaporte}
📞 ${userData.telefone || "N/A"}
🧑‍💼 ${userData.recrutador || "N/A"}

STATUS: APROVADO
      `));

    await client.channels.fetch(config.canais.logs)
      .then(c => c.send(`📊 ${userData.nome} aprovado.`));

    await client.channels.fetch(config.canais.logs_bot)
      .then(c => c.send(`⚙️ Aprovado: ${userData.nome}`));

    await interaction.update({
      content: "✅ APROVADO",
      components: []
    });
  }

  // ❌ REPROVAR
  if (acao === "reprovar") {
    userData.status = "REPROVADO";
    saveDB(db);

    await client.channels.fetch(config.canais.reprovados)
      .then(c => c.send(`❌ ${userData.nome} | ${userData.passaporte} reprovado.`));

    await client.channels.fetch(config.canais.logs_bot)
      .then(c => c.send(`⚙️ Reprovado: ${userData.nome}`));

    await interaction.update({
      content: "❌ REPROVADO",
      components: []
    });
  }
});

// 🚀 LOGIN
client.login(process.env.TOKEN);