const Discord = require('discord.js');
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = '.';
const TICKET_CATEGORY = 'Tickets'; // Category name for tickets
const LOG_CHANNEL = 'ticket-logs'; // Channel name for logs

// Ticket storage (in production, use a database)
const activeTickets = new Map();
const claimedTickets = new Map();

// Color scheme
const COLORS = {
  partnership: 0x5865F2,
  middleman: 0xFEE75C,
  support: 0x57F287,
  error: 0xED4245,
  success: 0x57F287,
  info: 0x5865F2
};

// Ticket types configuration
const TICKET_TYPES = {
  partnership: {
    name: 'Partnership',
    emoji: '🤝',
    color: COLORS.partnership,
    description: 'Discuss partnership opportunities'
  },
  middleman: {
    name: 'Middleman',
    emoji: '⚖️',
    color: COLORS.middleman,
    description: 'Request middleman services'
  },
  support: {
    name: 'Support',
    emoji: '🎫',
    color: COLORS.support,
    description: 'Get help and support'
  }
};

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  client.user.setActivity('.help | Ticket System', { type: Discord.ActivityType.Watching });
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Help Command
  if (command === 'help') {
    const embed = new Discord.EmbedBuilder()
      .setTitle('🎫 Ticket System - Help')
      .setDescription('Professional ticket management system for your server')
      .setColor(COLORS.info)
      .addFields(
        { name: '📋 Ticket Commands', value: '```\n.new <type> - Create a new ticket\n.close - Close current ticket\n.claim - Claim a ticket\n.unclaim - Unclaim a ticket\n.add <user> - Add user to ticket\n.remove <user> - Remove user from ticket\n.rename <name> - Rename ticket channel```', inline: false },
        { name: '🏷️ Ticket Types', value: '```\npartnership - Partnership inquiries\nmiddleman - Middleman services\nsupport - General support```', inline: false },
        { name: '⚙️ Setup Commands', value: '```\n.setup - Create ticket panel\n.stats - View ticket statistics```', inline: false }
      )
      .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // Setup Command
  if (command === 'setup') {
    if (!message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
      return message.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle('🎫 Create a Ticket')
      .setDescription('Click the button below to create a ticket based on your needs.\n\n**Available Ticket Types:**')
      .setColor(COLORS.info)
      .addFields(
        { name: '🤝 Partnership', value: 'For partnership opportunities and collaborations', inline: true },
        { name: '⚖️ Middleman', value: 'For secure middleman services', inline: true },
        { name: '🎫 Support', value: 'For general help and support', inline: true }
      )
      .setFooter({ text: 'Select a ticket type to get started' })
      .setTimestamp();

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('ticket_partnership')
          .setLabel('Partnership')
          .setEmoji('🤝')
          .setStyle(Discord.ButtonStyle.Primary),
        new Discord.ButtonBuilder()
          .setCustomId('ticket_middleman')
          .setLabel('Middleman')
          .setEmoji('⚖️')
          .setStyle(Discord.ButtonStyle.Secondary),
        new Discord.ButtonBuilder()
          .setCustomId('ticket_support')
          .setLabel('Support')
          .setEmoji('🎫')
          .setStyle(Discord.ButtonStyle.Success)
      );

    await message.channel.send({ embeds: [embed], components: [row] });
    return message.reply({ content: '✅ Ticket panel created successfully!', ephemeral: true });
  }

  // New Ticket Command
  if (command === 'new') {
    const type = args[0]?.toLowerCase();
    
    if (!type || !TICKET_TYPES[type]) {
      return message.reply({ content: `❌ Invalid ticket type! Use: \`partnership\`, \`middleman\`, or \`support\``, ephemeral: true });
    }

    await createTicket(message.guild, message.author, type);
    return message.reply({ content: '✅ Ticket created! Check your DMs or the ticket channel.', ephemeral: true });
  }

  // Close Command
  if (command === 'close') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    const embed = new Discord.EmbedBuilder()
      .setTitle('⚠️ Close Ticket')
      .setDescription('Are you sure you want to close this ticket?')
      .setColor(COLORS.error)
      .setFooter({ text: 'This action cannot be undone' });

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('confirm_close')
          .setLabel('Confirm Close')
          .setStyle(Discord.ButtonStyle.Danger),
        new Discord.ButtonBuilder()
          .setCustomId('cancel_close')
          .setLabel('Cancel')
          .setStyle(Discord.ButtonStyle.Secondary)
      );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // Claim Command
  if (command === 'claim') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    if (claimedTickets.has(message.channel.id)) {
      return message.reply({ content: '❌ This ticket is already claimed!', ephemeral: true });
    }

    claimedTickets.set(message.channel.id, message.author.id);

    const embed = new Discord.EmbedBuilder()
      .setDescription(`✅ Ticket claimed by ${message.author}`)
      .setColor(COLORS.success)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.channel.setName(`ticket-${message.channel.name.split('-')[1]}-claimed`);
  }

  // Unclaim Command
  if (command === 'unclaim') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    if (!claimedTickets.has(message.channel.id)) {
      return message.reply({ content: '❌ This ticket is not claimed!', ephemeral: true });
    }

    const claimer = claimedTickets.get(message.channel.id);
    if (claimer !== message.author.id && !message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
      return message.reply({ content: '❌ Only the claimer or an administrator can unclaim this ticket!', ephemeral: true });
    }

    claimedTickets.delete(message.channel.id);

    const embed = new Discord.EmbedBuilder()
      .setDescription(`✅ Ticket unclaimed by ${message.author}`)
      .setColor(COLORS.info)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
    await message.channel.setName(message.channel.name.replace('-claimed', ''));
  }

  // Add User Command
  if (command === 'add') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
    if (!user) {
      return message.reply({ content: '❌ Please mention a valid user or provide their ID!', ephemeral: true });
    }

    await message.channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    const embed = new Discord.EmbedBuilder()
      .setDescription(`✅ ${user} has been added to the ticket`)
      .setColor(COLORS.success)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // Remove User Command
  if (command === 'remove') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    const user = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
    if (!user) {
      return message.reply({ content: '❌ Please mention a valid user or provide their ID!', ephemeral: true });
    }

    await message.channel.permissionOverwrites.delete(user.id);

    const embed = new Discord.EmbedBuilder()
      .setDescription(`✅ ${user} has been removed from the ticket`)
      .setColor(COLORS.success)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // Rename Command
  if (command === 'rename') {
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    const newName = args.join('-').toLowerCase();
    if (!newName) {
      return message.reply({ content: '❌ Please provide a new name for the ticket!', ephemeral: true });
    }

    await message.channel.setName(`ticket-${newName}`);

    const embed = new Discord.EmbedBuilder()
      .setDescription(`✅ Ticket renamed to **ticket-${newName}**`)
      .setColor(COLORS.success)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // Stats Command
  if (command === 'stats') {
    const tickets = message.guild.channels.cache.filter(c => c.name.startsWith('ticket-'));
    const claimed = tickets.filter(c => claimedTickets.has(c.id));

    const embed = new Discord.EmbedBuilder()
      .setTitle('📊 Ticket Statistics')
      .setColor(COLORS.info)
      .addFields(
        { name: '🎫 Active Tickets', value: `\`${tickets.size}\``, inline: true },
        { name: '✅ Claimed Tickets', value: `\`${claimed.size}\``, inline: true },
        { name: '⏳ Unclaimed Tickets', value: `\`${tickets.size - claimed.size}\``, inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
});

// Button Interaction Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  // Ticket Creation Buttons
  if (interaction.customId.startsWith('ticket_')) {
    const type = interaction.customId.replace('ticket_', '');
    await interaction.deferReply({ ephemeral: true });
    await createTicket(interaction.guild, interaction.user, type);
    return interaction.editReply({ content: '✅ Ticket created! Check the ticket channel.' });
  }

  // Close Confirmation
  if (interaction.customId === 'confirm_close') {
    await interaction.deferUpdate();
    await closeTicket(interaction.channel, interaction.user);
  }

  if (interaction.customId === 'cancel_close') {
    await interaction.update({ content: '❌ Ticket closure cancelled.', embeds: [], components: [] });
  }
});

// Create Ticket Function
async function createTicket(guild, user, type) {
  const ticketType = TICKET_TYPES[type];
  
  // Find or create category
  let category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY && c.type === Discord.ChannelType.GuildCategory);
  if (!category) {
    category = await guild.channels.create({
      name: TICKET_CATEGORY,
      type: Discord.ChannelType.GuildCategory
    });
  }

  // Create ticket channel
  const ticketChannel = await guild.channels.create({
    name: `ticket-${user.username}-${type}`,
    type: Discord.ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [Discord.PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory]
      }
    ]
  });

  activeTickets.set(ticketChannel.id, { userId: user.id, type, createdAt: Date.now() });

  const embed = new Discord.EmbedBuilder()
    .setTitle(`${ticketType.emoji} ${ticketType.name} Ticket`)
    .setDescription(`Welcome ${user}!\n\n**Ticket Type:** ${ticketType.description}\n\nOur team will be with you shortly. Please describe your inquiry in detail.`)
    .setColor(ticketType.color)
    .addFields(
      { name: '📌 Commands', value: '`.close` - Close this ticket\n`.claim` - Claim this ticket\n`.add <user>` - Add a user\n`.remove <user>` - Remove a user', inline: false }
    )
    .setFooter({ text: `Ticket created by ${user.tag}`, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  const row = new Discord.ActionRowBuilder()
    .addComponents(
      new Discord.ButtonBuilder()
        .setCustomId('confirm_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(Discord.ButtonStyle.Danger)
    );

  await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
}

// Close Ticket Function
async function closeTicket(channel, user) {
  const ticketData = activeTickets.get(channel.id);
  
  const embed = new Discord.EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`Ticket closed by ${user}`)
    .setColor(COLORS.error)
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  // Log to ticket-logs channel if exists
  const logChannel = channel.guild.channels.cache.find(c => c.name === LOG_CHANNEL);
  if (logChannel) {
    const logEmbed = new Discord.EmbedBuilder()
      .setTitle('🎫 Ticket Closed')
      .addFields(
        { name: 'Channel', value: channel.name, inline: true },
        { name: 'Closed By', value: user.tag, inline: true },
        { name: 'Type', value: ticketData?.type || 'Unknown', inline: true }
      )
      .setColor(COLORS.error)
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  }

  activeTickets.delete(channel.id);
  claimedTickets.delete(channel.id);

  setTimeout(() => channel.delete().catch(console.error), 5000);
}

// Error Handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.TOKEN);
