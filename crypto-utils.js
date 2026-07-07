const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CryptoUtils {
    constructor() {
        this.salt = 'DikaKnit2024FixedSalt!@#$%^&*()_+';
        this.masterKey = this.loadOrCreateMasterKey();
    }

    loadOrCreateMasterKey() {
        // ПУТЬ К ПАПКЕ С СЕКРЕТАМИ (измените если путь другой)
        const secretsPath = path.join(__dirname, 'secrets');
        
        // Создаем папку если её нет
        if (!fs.existsSync(secretsPath)) {
            fs.mkdirSync(secretsPath, { recursive: true });
        }
        
        const keyPath = path.join(secretsPath, '.master.key');
        
        try {
            if (fs.existsSync(keyPath)) {
                const key = fs.readFileSync(keyPath, 'utf8').trim();
                if (key.length === 64) {
                    console.log('✅ Мастер-ключ загружен');
                    return key;
                } else {
                    console.log('⚠️ Мастер-ключ поврежден, создаем новый');
                }
            }
        } catch (e) {
            console.log('⚠️ Ошибка чтения ключа, создаем новый');
        }
        
        const key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, key);
        console.log('✅ Создан новый мастер-ключ');
        return key;
    }

    // Шифрование
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(this.masterKey, this.salt, 100000, 32, 'sha256');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(data), 'utf8'),
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag();
        
        return {
            iv: iv.toString('base64'),
            encrypted: encrypted.toString('base64'),
            tag: authTag.toString('base64')
        };
    }

    // Дешифрование
    decrypt(encryptedData) {
        try {
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
            const authTag = Buffer.from(encryptedData.tag, 'base64');
            
            const key = crypto.pbkdf2Sync(this.masterKey, this.salt, 100000, 32, 'sha256');
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]);
            
            return JSON.parse(decrypted.toString('utf8'));
        } catch (error) {
            throw new Error('Ошибка расшифровки: ' + error.message);
        }
    }

    // Создание подписи
    sign(data) {
        const jsonString = JSON.stringify(data);
        return crypto.createHmac('sha256', this.masterKey)
            .update(jsonString)
            .digest('hex');
    }

    // Проверка подписи
    verifySignature(data, signature) {
        const expectedSignature = this.sign(data);
        return signature === expectedSignature;
    }

    // ========================================
    //  СОЗДАНИЕ ЛИЦЕНЗИИ
    // ========================================
    createLicenseKey(hardwareId, expiresInDays, clientInfo) {
        const cleanHardwareId = String(hardwareId).trim();
        
        console.log('\n🔑 СОЗДАНИЕ ЛИЦЕНЗИИ:');
        console.log(`  Hardware ID: ${cleanHardwareId}`);
        console.log(`  Дней: ${expiresInDays}`);
        console.log(`  Клиент: ${clientInfo}`);
        console.log('========================================\n');
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiresInDays);

        const licenseData = {
            hardwareId: cleanHardwareId,
            expires: expiryDate.toISOString(),
            client: clientInfo.trim(),
            created: new Date().toISOString(),
            version: '1.0',
            id: crypto.randomBytes(8).toString('hex').toUpperCase()
        };

        const encrypted = this.encrypt(licenseData);
        const signature = this.sign(encrypted);

        return {
            data: encrypted,
            signature: signature
        };
    }

    // ========================================
    //  ПРОВЕРКА ЛИЦЕНЗИИ
    // ========================================
    verifyLicenseKey(licenseData, signature) {
        try {
            const expectedSignature = this.sign(licenseData);
            if (signature !== expectedSignature) {
                return { 
                    valid: false, 
                    error: 'Неверная подпись' 
                };
            }

            const decrypted = this.decrypt(licenseData);

            if (!decrypted.hardwareId) {
                return { 
                    valid: false, 
                    error: 'В лицензии отсутствует Hardware ID' 
                };
            }

            const expiryDate = new Date(decrypted.expires);
            const now = new Date();

            if (now > expiryDate) {
                return { 
                    valid: false, 
                    error: `Срок лицензии истек ${expiryDate.toLocaleDateString()}` 
                };
            }

            return { valid: true, data: decrypted };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

module.exports = new CryptoUtils();