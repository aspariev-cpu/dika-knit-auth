const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database', 'dika.db');

// Создаём папку, если нет
if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
}

// =========================================
// ПОДКЛЮЧЕНИЕ К БД
// =========================================
const db = new Database(DB_PATH);

// =========================================
// СОЗДАНИЕ ТАБЛИЦ
// =========================================
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        hardwareId TEXT,
        license TEXT,
        licenseExpires TEXT,
        createdAt TEXT NOT NULL,
        isAdmin INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        clientName TEXT NOT NULL,
        hardwareId TEXT NOT NULL,
        tariffKey TEXT NOT NULL,
        days INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        checkFile TEXT,
        checkUploadedAt TEXT,
        licenseFile TEXT,
        confirmedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tutorial_sections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        icon TEXT DEFAULT '📌',
        content TEXT NOT NULL,
        video TEXT,
        "order" INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tutorial_steps (
        id TEXT PRIMARY KEY,
        sectionId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        video TEXT,
        image TEXT,
        FOREIGN KEY (sectionId) REFERENCES tutorial_sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS updates (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        features TEXT
    );
`);

console.log('✅ База данных инициализирована');

// =========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С БД
// =========================================
function runQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result;
}

function getQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
}

function allQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

// =========================================
// ЭКСПОРТ
// =========================================
module.exports = {
    db,
    runQuery,
    getQuery,
    allQuery
};