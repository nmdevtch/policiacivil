require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');

// 🌐 WEB SERVER (Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot online ✅');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server rodando na porta ${PORT}`);
});

// 🤖 CLIENTE DISCORD (INTENTS CORRETAS)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers // 🔥 necessário pro auto cargo
  ]
});

// ⚙️ CONFIG
const CARGO_ESTAGIARIO_ID = "1485630417045422180";
const CARGO_VISITANTE_ID = "COLOQUE_ID_VISITANTE_AQUI";
const CANAL_APROVACAO_ID = "1487490815151444048";
const CANAL_LOGS_ID = "1487489523012206863";
const CANAL_PAINEL_ID = "1485639891441418381";

// ✅ ONLINE
client.once('clientReady', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  // 🔥 ENVIA PAINEL AUTOMÁTICO (evita duplicar toda vez)
  try {
    const canal = await client.channels.fetch(CANAL_PAINEL_ID);

    if (!canal) return;

    const mensagens = await canal.messages.fetch({ limit: 10 });
    const jaExiste = mensagens.find(m => m.author.id === client.user.id);

    if (jaExiste) return;

    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('solicitar_setagem')
        .setLabel('📋 Solicitar Setagem')
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({
      content: `👮 **Registro - Polícia Civil**

Clique no botão abaixo para solicitar sua setagem.

⚠️ Use seu nome real.`,
      components: [botao]
    });

  } catch (err) {
    console.log("Erro ao enviar painel:", err.message);
  }
});

// 👤 AUTO CARGO VISITANTE
client.on('guildMemberAdd', async (member) => {
  try {
    await member.roles.add(CARGO_VISITANTE_ID);
    console.log(`👤 ${member.user.tag} recebeu Visitante`);
  } catch (err) {
    console.error('Erro ao dar visitante:', err.message);
  }
});

// 🔘 INTERAÇÕES
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // 👉 BOTÃO ABRIR MODAL
    if (interaction.isButton() && interaction.customId === 'solicitar_setagem') {

      const modal = new ModalBuilder()
        .setCustomId('formulario_registro')
        .setTitle('Registro Polícia');

      const nomeInput = new TextInputBuilder()
        .setCustomId('nome')
        .setLabel('Seu nome completo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const idInput = new TextInputBuilder()
        .setCustomId('id_cidade')
        .setLabel('ID da cidade')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(idInput)
      );

      return interaction.showModal(modal);
    }

    // 👉 FORMULÁRIO
    if (interaction.isModalSubmit() && interaction.customId === 'formulario_registro') {

      const nome = interaction.fields.getTextInputValue('nome');
      const idCidade = interaction.fields.getTextInputValue('id_cidade');

      const canalAdmin = await client.channels.fetch(CANAL_APROVACAO_ID);
      if (!canalAdmin) {
        return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
      }

      const dados = {
        id: interaction.user.id,
        nome,
        cidade: idCidade
      };

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar|${JSON.stringify(dados)}`)
          .setLabel('✅ Aprovar')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`recusar|${JSON.stringify(dados)}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );

      await canalAdmin.send({
        content: `📋 **Nova Solicitação**

👤 <@${dados.id}>
📛 ${dados.nome}
🆔 ${dados.cidade}`,
        components: [botoes]
      });

      return interaction.reply({
        content: '✅ Solicitação enviada!',
        ephemeral: true
      });
    }

    // 👉 APROVAR / RECUSAR
    if (interaction.isButton() && interaction.customId.includes('|')) {

      const [acao, dados] = interaction.customId.split('|');
      const info = JSON.parse(dados);

      const canalLogs = await client.channels.fetch(CANAL_LOGS_ID);

      let membro;
      try {
        membro = await interaction.guild.members.fetch(info.id);
      } catch {
        return interaction.reply({ content: '❌ Usuário não encontrado.', ephemeral: true });
      }

      if (acao === 'aprovar') {

        await membro.roles.add(CARGO_ESTAGIARIO_ID);

        try {
          await membro.setNickname(`[EST] ${info.nome} | ${info.cidade}`);
        } catch {}

        if (canalLogs) {
          await canalLogs.send({
            content: `📁 **APROVADO**

👤 <@${info.id}>
📛 ${info.nome}
🆔 ${info.cidade}
👮 <@${interaction.user.id}>
🕒 <t:${Math.floor(Date.now()/1000)}:F>`
          });
        }

        return interaction.update({
          content: `✅ Aprovado: <@${info.id}>`,
          components: []
        });
      }

      if (acao === 'recusar') {

        if (canalLogs) {
          await canalLogs.send({
            content: `❌ **RECUSADO**

👤 <@${info.id}>
📛 ${info.nome}
👮 <@${interaction.user.id}>`
          });
        }

        return interaction.update({
          content: `❌ Recusado: <@${info.id}>`,
          components: []
        });
      }
    }

  } catch (err) {
    console.error("Erro geral:", err);

    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: '❌ Erro interno.', ephemeral: true });
    } else {
      interaction.reply({ content: '❌ Erro interno.', ephemeral: true });
    }
  }
});

// 🔐 LOGIN
client.login(process.env.TOKEN);