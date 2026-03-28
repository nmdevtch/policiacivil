require('dotenv').config({ quiet: true });

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

// 🌐 WEB SERVER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot online ✅');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server rodando na porta ${PORT}`);
});

// 🤖 CLIENTE (SEM INTENTS PRIVILEGIADAS)
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ⚙️ CONFIG
const CARGO_ESTAGIARIO_ID = "1485630417045422180";
const CARGO_VISITANTE_ID = "1485630755525759007";
const CANAL_APROVACAO_ID = "1487490815151444048";
const CANAL_LOGS_ID = "1487489523012206863";
const CANAL_PAINEL_ID = "1485639891441418381";

// 📦 Banco temporário
const registros = new Map();

// ✅ ONLINE
client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  try {
    const canal = await client.channels.fetch(CANAL_PAINEL_ID);
    if (!canal) return;

    const mensagens = await canal.messages.fetch({ limit: 10 });
    const jaExiste = mensagens.find(m => m.author.id === client.user.id);

    if (jaExiste) return;

    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('iniciar_registro')
        .setLabel('📋 Iniciar Registro')
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({
      content: `👮 **Sistema de Registro**

Clique abaixo para iniciar.`,
      components: [botao]
    });

  } catch (err) {
    console.log("Erro painel:", err.message);
  }
});

// 🔘 INTERAÇÕES
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // 👉 PRIMEIRO BOTÃO → DAR VISITANTE + ABRIR
    if (interaction.isButton() && interaction.customId === 'iniciar_registro') {

      const membro = await interaction.guild.members.fetch(interaction.user.id);

      // 🔥 Dá visitante na interação
      try {
        if (!membro.roles.cache.has(CARGO_VISITANTE_ID)) {
          await membro.roles.add(CARGO_VISITANTE_ID);
        }
      } catch {}

      const botao = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('solicitar_setagem')
          .setLabel('📋 Solicitar Setagem')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        content: '✅ Você recebeu acesso inicial.',
        components: [botao],
        ephemeral: true
      });
    }

    // 👉 ABRIR MODAL
    if (interaction.isButton() && interaction.customId === 'solicitar_setagem') {

      const modal = new ModalBuilder()
        .setCustomId('formulario_registro')
        .setTitle('Registro Polícia');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nome')
            .setLabel('Seu nome completo')
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('id_cidade')
            .setLabel('ID da cidade')
            .setStyle(TextInputStyle.Short)
        )
      );

      return interaction.showModal(modal);
    }

    // 👉 FORMULÁRIO
    if (interaction.isModalSubmit()) {

      const nome = interaction.fields.getTextInputValue('nome');
      const cidade = interaction.fields.getTextInputValue('id_cidade');

      const idRegistro = Date.now().toString();

      registros.set(idRegistro, {
        userId: interaction.user.id,
        nome,
        cidade
      });

      const canal = await client.channels.fetch(CANAL_APROVACAO_ID);

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_${idRegistro}`)
          .setLabel('✅ Aprovar')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`recusar_${idRegistro}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );

      await canal.send({
        content: `📋 Nova Solicitação

👤 <@${interaction.user.id}>
📛 ${nome}
🆔 ${cidade}`,
        components: [botoes]
      });

      return interaction.reply({
        content: '✅ Solicitação enviada!',
        ephemeral: true
      });
    }

    // 👉 APROVAR / RECUSAR
    if (interaction.isButton() && interaction.customId.includes('_')) {

      const [acao, idRegistro] = interaction.customId.split('_');
      const dados = registros.get(idRegistro);

      if (!dados) {
        return interaction.reply({ content: '❌ Dados não encontrados.', ephemeral: true });
      }

      const membro = await interaction.guild.members.fetch(dados.userId);
      const logs = await client.channels.fetch(CANAL_LOGS_ID);

      if (acao === 'aprovar') {

        await membro.roles.add(CARGO_ESTAGIARIO_ID);

        try {
          await membro.setNickname(`[EST] ${dados.nome} | ${dados.cidade}`);
        } catch {}

        logs?.send(`✅ Aprovado: <@${dados.userId}>`);

        registros.delete(idRegistro);

        return interaction.update({
          content: `✅ Aprovado: <@${dados.userId}>`,
          components: []
        });
      }

      if (acao === 'recusar') {

        logs?.send(`❌ Recusado: <@${dados.userId}>`);

        registros.delete(idRegistro);

        return interaction.update({
          content: `❌ Recusado: <@${dados.userId}>`,
          components: []
        });
      }
    }

  } catch (err) {
    console.error("Erro:", err);
  }
});

// 🔐 LOGIN
client.login(process.env.TOKEN);