const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const os = require('os');
const axios = require('axios');
const discordBot = require('./discord-bot.js');
const dbModule = require('./database.js');
const { runQuery, getQuery, allQuery } = dbModule;
require('dotenv').config();

const CryptoUtils = require('./crypto-utils.js');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================
// MIDDLEWARE
// =========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dika-knit-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

// =========================================
// ПУТИ
// =========================================
const LICENSES_PATH = path.join(os.homedir(), 'Desktop', 'Project', 'Лицензия');
const CHECKS_PATH = path.join(__dirname, 'public', 'uploads', 'checks');
const UPLOADS_PATH = path.join(__dirname, 'public', 'uploads', 'media');

// =========================================
// СОЗДАНИЕ ПАПОК
// =========================================
const foldersToCreate = [
    LICENSES_PATH,
    CHECKS_PATH,
    path.join(__dirname, 'database'),
    path.join(__dirname, 'public', 'uploads'),
    UPLOADS_PATH
];

console.log('\n📁 СОЗДАНИЕ ПАПОК:');
foldersToCreate.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`   ✅ Создана: ${folder}`);
    } else {
        console.log(`   ✅ Уже есть: ${folder}`);
    }
});

// =========================================
// СОЗДАНИЕ АДМИНА (если нет)
// =========================================
async function createAdminIfNotExists() {
    try {
        const admin = await getQuery('SELECT * FROM users WHERE username = ?', ['admin']);
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await runQuery(`
                INSERT INTO users (id, username, email, password, createdAt, isAdmin)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['admin-001', 'admin', 'admin@dikaknit.com', hashedPassword, new Date().toISOString(), 1]);
            console.log('   ✅ Создан админ (логин: admin, пароль: admin123)');
        }
    } catch (error) {
        console.error('   ⚠️ Ошибка создания админа:', error);
    }
}

// =========================================
// МИДЛВАР ДЛЯ ПРОВЕРКИ АДМИНА
// =========================================
async function isAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    try {
        const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Доступ запрещён' });
        }
        next();
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}

// =========================================
// ТАРИФЫ
// =========================================
const TARIFFS = {
    test: { days: 1, price: 1, label: '🧪 Тестовый' },
    week: { days: 7, price: 1000, label: '1 неделя' },
    month: { days: 30, price: 2000, label: '1 месяц' },
    quarter: { days: 90, price: 5000, label: '3 месяца' },
    year: { days: 365, price: 16000, label: '1 год' }
};

// =========================================
// НАСТРОЙКА MULTER
// =========================================
const checkStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, CHECKS_PATH);
    },
    filename: function (req, file, cb) {
        const orderId = req.body.orderId || Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `check_${orderId}${ext}`);
    }
});

const uploadCheck = multer({ 
    storage: checkStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Только изображения и PDF'));
        }
    }
});

const mediaStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_PATH);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'media_' + unique + ext);
    }
});

const uploadMedia = multer({
    storage: mediaStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения и видео'));
        }
    }
});

// =========================================
// ЗАПУСК
// =========================================
async function startServer() {
    await createAdminIfNotExists();

    // =========================================
    // АВТОРИЗАЦИЯ
    // =========================================
    app.post('/api/register', async (req, res) => {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Все поля обязательны' });
            }

            if (username.length < 3) {
                return res.status(400).json({ error: 'Имя пользователя минимум 3 символа' });
            }

            if (!email.includes('@') || !email.includes('.')) {
                return res.status(400).json({ error: 'Введите корректный email' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Пароль минимум 6 символов' });
            }

            // Проверка существующего пользователя
            const existing = await getQuery('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
            if (existing) {
                if (existing.username === username) {
                    return res.status(400).json({ error: 'Пользователь уже существует' });
                }
                if (existing.email === email) {
                    return res.status(400).json({ error: 'Email уже используется' });
                }
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = uuidv4();

            await runQuery(`
                INSERT INTO users (id, username, email, password, createdAt, isAdmin)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [userId, username, email, hashedPassword, new Date().toISOString(), 0]);

            req.session.regenerate((err) => {
                if (err) {
                    console.error('Ошибка пересоздания сессии:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                
                req.session.userId = userId;
                req.session.username = username;
                
                console.log(`✅ Зарегистрирован: ${username}`);

                res.json({ 
                    success: true, 
                    user: { 
                        id: userId, 
                        username: username, 
                        email: email,
                        isAdmin: false
                    } 
                });
            });

        } catch (error) {
            console.error('Ошибка регистрации:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { username, password, remember } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Введите логин и пароль' });
            }

            console.log(`🔑 Попытка входа: ${username}`);

            const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);

            if (!user) {
                console.log(`❌ Пользователь не найден: ${username}`);
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                console.log(`❌ Неверный пароль для: ${username}`);
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            req.session.userId = user.id;
            req.session.username = user.username;
            
            if (remember) {
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
            }

            console.log(`✅ Успешный вход: ${username} (admin: ${user.isAdmin})`);

            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    email: user.email,
                    hardwareId: user.hardwareId,
                    hasLicense: !!user.license,
                    isAdmin: user.isAdmin || false
                } 
            });

        } catch (error) {
            console.error('Ошибка входа:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    app.get('/api/check-session', async (req, res) => {
        if (req.session.userId) {
            try {
                const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.session.userId]);
                if (user) {
                    return res.json({ 
                        authenticated: true, 
                        user: { 
                            id: user.id, 
                            username: user.username, 
                            email: user.email,
                            hardwareId: user.hardwareId,
                            hasLicense: !!user.license,
                            isAdmin: user.isAdmin || false
                        } 
                    });
                }
            } catch (error) {
                console.error('Ошибка проверки сессии:', error);
            }
        }
        res.json({ authenticated: false });
    });

    app.post('/api/logout', (req, res) => {
        req.session.destroy();
        res.json({ success: true });
    });

    // =========================================
    // ЛИЦЕНЗИИ
    // =========================================
    app.post('/api/generate-payment', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Необходима авторизация' });
            }

            const { tariffKey, clientName, hardwareId } = req.body;

            if (!tariffKey || !clientName || !hardwareId) {
                return res.status(400).json({ error: 'Все поля обязательны' });
            }

            if (!TARIFFS[tariffKey]) {
                return res.status(400).json({ error: 'Неверный тариф' });
            }

            const tariff = TARIFFS[tariffKey];
            const orderId = uuidv4();

            await runQuery(`
                INSERT INTO orders (id, userId, clientName, hardwareId, tariffKey, days, amount, status, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [orderId, req.session.userId, clientName, hardwareId, tariffKey, tariff.days, tariff.price, 'pending', new Date().toISOString()]);

            console.log(`📝 Создан заказ: ${orderId} (${clientName}, ${tariff.price}₽)`);

            await discordBot.sendNewOrderNotification({
                id: orderId,
                clientName: clientName,
                tariffLabel: tariff.label,
                amount: tariff.price,
                hardwareId: hardwareId
            });

            const cardNumber = '2200702183473706';
            const qrText = `Перевод ${tariff.price} руб. на карту ${cardNumber}. Назначение: Лицензия Dika Knit ${orderId}`;
            const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrText)}&bgcolor=ffffff&color=1a1a2e&margin=10`;

            res.json({
                success: true,
                orderId: orderId,
                qrCode: qrCode,
                amount: tariff.price,
                tariff: tariff.label,
                cardNumber: cardNumber,
                phone: '+79897826405'
            });

        } catch (error) {
            console.error('Ошибка:', error);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });

    app.post('/api/upload-check', uploadCheck.single('checkImage'), async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Необходима авторизация' });
            }

            const { orderId } = req.body;
            if (!orderId) {
                return res.status(400).json({ error: 'Не указан заказ' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }

            await runQuery(`
                UPDATE orders SET checkFile = ?, checkUploadedAt = ?, status = 'check_uploaded'
                WHERE id = ?
            `, [req.file.filename, new Date().toISOString(), orderId]);

            console.log(`📎 Загружен чек для заказа: ${orderId}`);

            const baseUrl = `http://localhost:${PORT}`;
            const checkUrl = `${baseUrl}/uploads/checks/${req.file.filename}`;

            await discordBot.sendOrderNotification({
                id: orderId,
                clientName: order.clientName,
                tariffLabel: TARIFFS[order.tariffKey].label,
                amount: order.amount,
                hardwareId: order.hardwareId
            }, checkUrl);

            res.json({
                success: true,
                message: 'Чек загружен! Ожидайте подтверждения.',
                fileName: req.file.filename
            });

        } catch (error) {
            console.error('Ошибка загрузки чека:', error);
            res.status(500).json({ error: 'Ошибка загрузки чека' });
        }
    });

    app.get('/api/order-status/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            
            const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }

            res.json({
                status: order.status,
                checkFile: order.checkFile,
                confirmedAt: order.confirmedAt,
                licenseFile: order.licenseFile
            });

        } catch (error) {
            console.error('Ошибка:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.get('/api/get-license/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            
            const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }

            if (order.status !== 'completed') {
                return res.status(400).json({ error: 'Заказ ещё не подтверждён' });
            }

            if (!order.licenseFile) {
                return res.status(404).json({ error: 'Лицензия не найдена' });
            }

            const filePath = path.join(LICENSES_PATH, order.licenseFile);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Файл лицензии не найден' });
            }

            res.download(filePath, order.licenseFile);

        } catch (error) {
            console.error('Ошибка:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.post('/api/confirm-payment', async (req, res) => {
        try {
            const { orderId } = req.body;
            if (!orderId) {
                return res.status(400).json({ error: 'Не указан заказ' });
            }

            const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }

            if (order.status === 'completed') {
                return res.status(400).json({ error: 'Заказ уже подтверждён' });
            }

            const license = CryptoUtils.createLicenseKey(
                order.hardwareId,
                order.days,
                `${order.clientName} <89897826405 (WhatsApp)>`
            );

            const safeName = order.clientName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `license_${safeName}_${timestamp}.lic`;
            const filePath = path.join(LICENSES_PATH, fileName);
            fs.writeFileSync(filePath, JSON.stringify(license, null, 2));

            await runQuery(`
                UPDATE orders SET status = 'completed', licenseFile = ?, confirmedAt = ?
                WHERE id = ?
            `, [fileName, new Date().toISOString(), orderId]);

            await runQuery(`
                UPDATE users SET license = ?, licenseExpires = ?, hardwareId = ?
                WHERE id = ?
            `, [JSON.stringify(license), new Date(Date.now() + order.days * 24 * 60 * 60 * 1000).toISOString(), order.hardwareId, order.userId]);

            console.log(`✅ Подтверждён заказ: ${orderId}, выдана лицензия: ${fileName}`);

            res.json({
                success: true,
                message: 'Оплата подтверждена! Лицензия выдана.',
                licenseFile: fileName,
                downloadUrl: `/api/get-license/${orderId}`,
                clientName: order.clientName
            });

        } catch (error) {
            console.error('Ошибка подтверждения:', error);
            res.status(500).json({ error: 'Ошибка подтверждения оплаты' });
        }
    });

    app.post('/api/reject-payment', async (req, res) => {
        try {
            const { orderId } = req.body;
            if (!orderId) {
                return res.status(400).json({ error: 'Не указан заказ' });
            }

            const order = await getQuery('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }

            await runQuery('UPDATE orders SET status = "rejected" WHERE id = ?', [orderId]);
            console.log(`❌ Отклонён заказ: ${orderId}`);

            res.json({
                success: true,
                message: 'Оплата отклонена'
            });

        } catch (error) {
            console.error('Ошибка отклонения:', error);
            res.status(500).json({ error: 'Ошибка отклонения оплаты' });
        }
    });

    // =========================================
    // АДМИН-ЭНДПОЙНТЫ
    // =========================================
    app.get('/api/admin/orders', isAdmin, async (req, res) => {
        try {
            const orders = await allQuery('SELECT * FROM orders ORDER BY createdAt DESC');
            res.json({ orders });
        } catch (error) {
            console.error('Ошибка:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    // =========================================
    // HWID
    // =========================================
    app.post('/api/save-hwid', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Не авторизован' });
            }

            const { hardwareId } = req.body;
            if (!hardwareId) {
                return res.status(400).json({ error: 'HWID обязателен' });
            }

            await runQuery('UPDATE users SET hardwareId = ? WHERE id = ?', [hardwareId, req.session.userId]);
            console.log(`✅ HWID сохранён: ${hardwareId}`);

            res.json({ success: true });
        } catch (error) {
            console.error('Ошибка сохранения HWID:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.get('/api/generate-hwid', (req, res) => {
        const hwid = 'HW-' + Math.random().toString(16).toUpperCase().slice(2, 10) + 
                      '-' + Math.random().toString(16).toUpperCase().slice(2, 6);
        res.json({ hardwareId: hwid });
    });

    // =========================================
    // ТУТОРИАЛ
    // =========================================
    app.get('/api/tutorial', async (req, res) => {
        try {
            const sections = await allQuery('SELECT * FROM tutorial_sections ORDER BY "order" ASC');
            
            for (const section of sections) {
                const steps = await allQuery('SELECT * FROM tutorial_steps WHERE sectionId = ?', [section.id]);
                section.steps = steps;
            }
            
            res.json({ sections });
        } catch (error) {
            console.error('Ошибка получения туториала:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.get('/api/tutorial/:id', isAdmin, async (req, res) => {
        try {
            const section = await getQuery('SELECT * FROM tutorial_sections WHERE id = ?', [req.params.id]);
            if (!section) {
                return res.status(404).json({ error: 'Раздел не найден' });
            }
            
            const steps = await allQuery('SELECT * FROM tutorial_steps WHERE sectionId = ?', [section.id]);
            section.steps = steps;
            
            res.json(section);
        } catch (error) {
            console.error('Ошибка получения раздела:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.post('/api/tutorial', isAdmin, async (req, res) => {
        try {
            const { title, icon, content, video, order } = req.body;
            if (!title || !content) {
                return res.status(400).json({ error: 'Название и содержание обязательны' });
            }

            const id = 'section_' + Date.now();
            await runQuery(`
                INSERT INTO tutorial_sections (id, title, icon, content, video, "order")
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, title, icon || '📌', content, video || null, order || 0]);

            const section = await getQuery('SELECT * FROM tutorial_sections WHERE id = ?', [id]);
            section.steps = [];

            res.json({ success: true, section });
        } catch (error) {
            console.error('Ошибка добавления раздела:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.put('/api/tutorial/:id', isAdmin, async (req, res) => {
        try {
            const { title, icon, content, video, order } = req.body;
            
            await runQuery(`
                UPDATE tutorial_sections 
                SET title = ?, icon = ?, content = ?, video = ?, "order" = ?
                WHERE id = ?
            `, [title, icon, content, video, order, req.params.id]);

            const section = await getQuery('SELECT * FROM tutorial_sections WHERE id = ?', [req.params.id]);
            section.steps = await allQuery('SELECT * FROM tutorial_steps WHERE sectionId = ?', [section.id]);

            res.json({ success: true, section });
        } catch (error) {
            console.error('Ошибка обновления раздела:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.delete('/api/tutorial/:id', isAdmin, async (req, res) => {
        try {
            await runQuery('DELETE FROM tutorial_sections WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (error) {
            console.error('Ошибка удаления раздела:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    // Шаги туториала
    app.post('/api/tutorial/:sectionId/steps', isAdmin, async (req, res) => {
        try {
            const { title, description, video, image } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Название шага обязательно' });
            }

            const id = 'step_' + Date.now();
            await runQuery(`
                INSERT INTO tutorial_steps (id, sectionId, title, description, video, image)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, req.params.sectionId, title, description || '', video || null, image || null]);

            const step = await getQuery('SELECT * FROM tutorial_steps WHERE id = ?', [id]);
            res.json({ success: true, step });
        } catch (error) {
            console.error('Ошибка добавления шага:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.delete('/api/tutorial/:sectionId/steps/:stepId', isAdmin, async (req, res) => {
        try {
            await runQuery('DELETE FROM tutorial_steps WHERE id = ? AND sectionId = ?', [req.params.stepId, req.params.sectionId]);
            res.json({ success: true });
        } catch (error) {
            console.error('Ошибка удаления шага:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    // =========================================
    // ОБНОВЛЕНИЯ
    // =========================================
    app.get('/api/updates', async (req, res) => {
        try {
            const updates = await allQuery('SELECT * FROM updates ORDER BY date DESC');
            res.json({ updates });
        } catch (error) {
            console.error('Ошибка получения обновлений:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.get('/api/updates/:id', isAdmin, async (req, res) => {
        try {
            const update = await getQuery('SELECT * FROM updates WHERE id = ?', [req.params.id]);
            if (!update) {
                return res.status(404).json({ error: 'Обновление не найдено' });
            }
            res.json(update);
        } catch (error) {
            console.error('Ошибка получения обновления:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.post('/api/updates', isAdmin, async (req, res) => {
        try {
            const { version, date, title, content, features } = req.body;
            if (!version || !title || !content) {
                return res.status(400).json({ error: 'Версия, название и содержание обязательны' });
            }

            const id = 'update_' + Date.now();
            await runQuery(`
                INSERT INTO updates (id, version, date, title, content, features)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, version, date || new Date().toISOString().split('T')[0], title, content, JSON.stringify(features || [])]);

            const update = await getQuery('SELECT * FROM updates WHERE id = ?', [id]);
            res.json({ success: true, update });
        } catch (error) {
            console.error('Ошибка добавления обновления:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.put('/api/updates/:id', isAdmin, async (req, res) => {
        try {
            const { version, date, title, content, features } = req.body;
            
            await runQuery(`
                UPDATE updates 
                SET version = ?, date = ?, title = ?, content = ?, features = ?
                WHERE id = ?
            `, [version, date, title, content, JSON.stringify(features || []), req.params.id]);

            const update = await getQuery('SELECT * FROM updates WHERE id = ?', [req.params.id]);
            res.json({ success: true, update });
        } catch (error) {
            console.error('Ошибка обновления:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    app.delete('/api/updates/:id', isAdmin, async (req, res) => {
        try {
            await runQuery('DELETE FROM updates WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (error) {
            console.error('Ошибка удаления:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    // =========================================
    // МЕДИА
    // =========================================
    app.post('/api/upload-media', isAdmin, uploadMedia.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            const fileUrl = `/uploads/media/${req.file.filename}`;
            res.json({
                success: true,
                url: fileUrl,
                filename: req.file.filename
            });
        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            res.status(500).json({ error: 'Ошибка загрузки файла' });
        }
    });

    app.delete('/api/upload-media/:filename', isAdmin, async (req, res) => {
        try {
            const filePath = path.join(UPLOADS_PATH, req.params.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Файл не найден' });
            }
        } catch (error) {
            console.error('Ошибка удаления файла:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    });

    // =========================================
    // ЗАПУСК СЕРВЕРА
    // =========================================
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════╗
║   🧶 Dika Knit License Platform           ║
║   🚀 Сервер запущен на порту ${PORT}       ║
║   📍 http://localhost:${PORT}              ║
║   📁 Лицензии: ${LICENSES_PATH}            ║
║   📁 Чеки: ${CHECKS_PATH}                  ║
║   👤 Админ: admin / admin123              ║
║   ⏰ Сессия: 30 дней                      ║
║   🗄️ База данных: SQLite                  ║
╚═══════════════════════════════════════════╝
        `);
    });
}

// ЗАПУСК
startServer().catch(console.error);