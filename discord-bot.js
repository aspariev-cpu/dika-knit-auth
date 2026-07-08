const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// =========================================
// КОНФИГУРАЦИЯ
// =========================================
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

console.log('📋 ПРОВЕРКА КОНФИГА:');
console.log('   TOKEN:', TOKEN ? '✅ Есть' : '❌ НЕТ!');
console.log('   CHANNEL_ID:', CHANNEL_ID ? '✅ Есть' : '❌ НЕТ!');
console.log('   SERVER_URL:', SERVER_URL);
console.log('');

if (!TOKEN) {
    console.error('❌ Ошибка: DISCORD_BOT_TOKEN не найден');
    process.exit(1);
}

if (!CHANNEL_ID) {
    console.error('❌ Ошибка: DISCORD_CHANNEL_ID не найден');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`✅ Discord бот запущен: ${client.user.tag}`);
    console.log(`📡 Подключен к каналу: ${CHANNEL_ID}`);
    console.log(`🔗 Сервер: ${SERVER_URL}`);
    console.log('');
    console.log('🎯 Бот готов к работе!');
});

// =========================================
// ОБРАБОТКА КНОПОК
// =========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    const [action, orderId] = customId.split('_');

    console.log(`🔘 Нажата кнопка: ${action} для заказа ${orderId}`);

    if (action === 'confirm') {
        await interaction.deferUpdate();
        
        try {
            const response = await axios.post(`${SERVER_URL}/api/confirm-payment`, { orderId });
            
            if (response.data.success) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ ОПЛАТА ПОДТВЕРЖДЕНА!')
                    .setDescription(`Заказ **${orderId.slice(0,8)}** успешно подтверждён`)
                    .setColor(0x57F287)
                    .setFooter({ text: '🧶 Dika Knit License System' })
                    .setTimestamp();

                await interaction.editReply({
                    content: `✅ **Лицензия выдана!** Заказ: \`${orderId.slice(0,8)}\``,
                    embeds: [embed],
                    components: []
                });

            } else {
                await interaction.editReply({
                    content: `❌ Ошибка: ${response.data.error || 'Неизвестная ошибка'}`,
                    components: []
                });
            }
        } catch (error) {
            console.error('❌ Ошибка подтверждения:', error.message);
            await interaction.editReply({
                content: `❌ Ошибка при подтверждении: ${error.message}`,
                components: []
            });
        }
    }

    if (action === 'reject') {
        await interaction.deferUpdate();
        
        const embed = new EmbedBuilder()
            .setTitle('❌ ОПЛАТА ОТКЛОНЕНА')
            .setDescription(`Заказ **${orderId.slice(0,8)}** отклонён`)
            .setColor(0xED4245)
            .setFooter({ text: '🧶 Dika Knit License System' })
            .setTimestamp();

        await interaction.editReply({
            content: `❌ **Оплата отклонена.** Заказ: \`${orderId.slice(0,8)}\``,
            embeds: [embed],
            components: []
        });
    }
});

client.on('error', error => {
    console.error('❌ Ошибка бота:', error);
});

client.login(TOKEN);

// =========================================
// ОТПРАВКА УВЕДОМЛЕНИЯ С ЧЕКОМ
// =========================================
async function sendOrderNotification(order, checkUrl) {
    try {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Канал ${CHANNEL_ID} не найден`);
            return false;
        }

        // ✅ ПРЯМАЯ ССЫЛКА НА ИЗОБРАЖЕНИЕ
        const imageUrl = checkUrl;

        const embed = new EmbedBuilder()
            .setTitle('📎 ЗАГРУЖЕН ЧЕК!')
            .setDescription(`**Заказ:** \`${order.id.slice(0,8)}\``)
            .setColor(0xFEE75C)
            .addFields(
                { name: '🧑‍💼 Клиент', value: order.clientName, inline: true },
                { name: '📋 Тариф', value: order.tariffLabel || '—', inline: true },
                { name: '💰 Сумма', value: `${Number(order.amount).toLocaleString()} ₽`, inline: true }
            )
            .setImage(imageUrl)  // ✅ ФОТО ЧЕКА ПОКАЗЫВАЕТСЯ ПРЯМО В СООБЩЕНИИ
            .setFooter({ text: 'Нажмите кнопку для подтверждения' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${order.id}`)
                    .setLabel('✅ Подтвердить')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_${order.id}`)
                    .setLabel('❌ Отклонить')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({
            content: `📎 **Новый чек для проверки!**`,
            embeds: [embed],
            components: [row]
        });

        console.log(`✅ Уведомление с чеком отправлено в Discord для заказа ${order.id}`);
        return true;

    } catch (error) {
        console.error('❌ Ошибка отправки:', error.message);
        return false;
    }
}

// =========================================
// ОТПРАВКА УВЕДОМЛЕНИЯ О НОВОМ ЗАКАЗЕ
// =========================================
async function sendNewOrderNotification(order) {
    try {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Канал ${CHANNEL_ID} не найден`);
            return false;
        }

        const embed = new EmbedBuilder()
            .setTitle('📦 НОВЫЙ ЗАКАЗ!')
            .setColor(0x5865F2)
            .addFields(
                { name: '🧑‍💼 Клиент', value: order.clientName, inline: true },
                { name: '📋 Тариф', value: order.tariffLabel || '—', inline: true },
                { name: '💰 Сумма', value: `${Number(order.amount).toLocaleString()} ₽`, inline: true },
                { name: '🆔 Hardware ID', value: `\`${order.hardwareId}\``, inline: false },
                { name: '🔑 Заказ', value: `\`${order.id}\``, inline: false }
            )
            .setFooter({ text: 'Ожидается загрузка чека' })
            .setTimestamp();

        await channel.send({
            content: `📦 **Новый заказ от ${order.clientName}!**`,
            embeds: [embed]
        });

        return true;

    } catch (error) {
        console.error('❌ Ошибка отправки:', error.message);
        return false;
    }
}

module.exports = {
    sendOrderNotification,
    sendNewOrderNotification
};
