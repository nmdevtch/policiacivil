require("dotenv").config();
const fs = require("fs");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

const config = require("./config.json");

// 🌐 Web server (Render)
const app = express();
app.get("/", (req, res) => res.send("Bot Online 🚔"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Web server ativo"));

// 🤖 Cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel]
});

// 📂 Banco
function loadDB() {
  return JSON.parse(fs.readFileSync("./database.json"));
}

function saveDB(data) {
  fs.writeFileSync("./database.json", JSON.stringify(data, null, 2));
}

// ✅ READY (AUTO PAINEL)
client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  try {
    const canal = await client.channels.fetch(config.canais.comece_aqui);

    // 🧹 (Opcional) limpar mensagens antigas
    const msgs = await canal.messages.fetch({ limit: 10 });
    await canal.bulkDelete(msgs);

    // 📦 Embed
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("👮 Registro - Polícia Civil")
      .setDescription(
`Clique no botão abaixo para solicitar sua setagem. Sua solicitação será analisada por um administrador.

📋 **Como Funciona**
1. Clique em "Se Registrar"
2. Preencha seu nome
3. Informe seu ID
4. Aguarde aprovação

⚠️ **Importante**
• Use seu nome real  
• ID deve ser numérico  
• Aguarde análise`
      )
      .setFooter({ text: "Sistema de Registro • Polícia Civil" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("registrar")
        .setLabel("📄 Se Registrar")
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.log("Erro ao enviar painel:", err);
  }
});

// 📌 BOTÃO REGISTRAR
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "registrar") {
    await interaction.reply({
      content: `📋 Envie o formulário neste canal:

**Modelo:**
Nome:
ID:
Telefone:
Recrutador:`,
      ephemeral: true
    });
  }
});

// 📥 FORMULÁRIO
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== config.canais.formulario) return;

  const nome = message.content.match(/Nome:\s*(.*)/i)?.[1];
  const id = message.content.match(/ID:\s*(.*)/i)?.[1];
  const telefone = message.content.match(/Telefone:\s*(.*)/i)?.[1];
  const recrutador = message.content.match(/Recrutador:\s*(.*)/i)?.[1];

  if (!nome || !id) {
    return message.reply("❌ Preencha corretamente.");
  }

  const db = loadDB();

  db.usuarios.push({
    discordId: message.author.id,
    nome,
    passaporte: id,
    telefone,
    recrutador,
    status: "EM_ANALISE"
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

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("📥 Nova Candidatura")
    .addFields(
      { name: "👤 Nome", value: nome },
      { name: "🆔 ID", value: id },
      { name: "📞 Telefone", value: telefone || "N/A" },
      { name: "🧑‍💼 Recrutador", value: recrutador || "N/A" }
    );

  canalAnalise.send({
    embeds: [embed],
    components: [row]
  });

  message.reply("📨 Enviado para análise!");
});

// 🎯 BOTÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [acao, userId] = interaction.customId.split("_");
  if (!userId) return;

  const db = loadDB();
  const userData = db.usuarios.find(u => u.discordId === userId);

  if (!userData) return;

  const membro = await interaction.guild.members.fetch(userId);

  if (acao === "aprovar") {
    await membro.roles.remove(config.cargos.visitante);
    await membro.roles.add(config.cargos.aluno);

    await membro.setNickname(`[AL] ${userData.nome} | ${userData.passaporte}`);

    userData.status = "APROVADO";
    saveDB(db);

    await interaction.update({ content: "✅ APROVADO", components: [] });
  }

  if (acao === "reprovar") {
    userData.status = "REPROVADO";
    saveDB(db);

    await interaction.update({ content: "❌ REPROVADO", components: [] });
  }
});

client.login(process.env.TOKEN);