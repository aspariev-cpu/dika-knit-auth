// Модуль для работы с лицензиями на клиенте

class LicenseManager {
    constructor() {
        this.apiUrl = '/api';
    }

    // Проверка статуса лицензии текущего пользователя
    async checkLicenseStatus() {
        try {
            const response = await fetch(`${this.apiUrl}/user-license`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Ошибка проверки лицензии:', error);
            return { hasLicense: false, error: error.message };
        }
    }

    // Активация лицензии по файлу
    async activateLicense(file) {
        try {
            const text = await file.text();
            const licenseData = JSON.parse(text);

            const response = await fetch(`${this.apiUrl}/activate-license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseFile: licenseData })
            });

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Генерация QR-кода для оплаты
    async generatePayment(hardwareId, days) {
        try {
            const response = await fetch(`${this.apiUrl}/generate-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hardwareId, days })
            });

            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }

    // Проверка статуса оплаты
    async checkPaymentStatus(orderId) {
        try {
            const response = await fetch(`${this.apiUrl}/check-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });

            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }

    // Получение информации о лицензии из файла (без активации)
    async readLicenseFile(file) {
        try {
            const text = await file.text();
            const licenseData = JSON.parse(text);
            
            // Проверяем наличие всех необходимых полей
            if (!licenseData.data || !licenseData.signature) {
                throw new Error('Неверный формат файла лицензии');
            }

            return {
                valid: true,
                data: licenseData
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // Форматирование даты для отображения
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Расчет оставшегося времени лицензии
    getRemainingDays(expiresDate) {
        const now = new Date();
        const expire = new Date(expiresDate);
        const diffTime = expire - now;
        
        if (diffTime <= 0) return 0;
        
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Генерация случайного Hardware ID (для демонстрации)
    generateHardwareId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Проверка валидности Hardware ID
    validateHardwareId(hardwareId) {
        // Минимальная проверка - не пустая строка
        return hardwareId && hardwareId.trim().length > 0;
    }

    // Создание объекта для отображения статуса лицензии
    getLicenseDisplayInfo(licenseData) {
        if (!licenseData || !licenseData.valid) {
            return {
                status: 'inactive',
                statusText: 'Не активирована',
                statusClass: 'status-inactive',
                icon: '⚠️',
                message: 'Лицензия не активирована или истекла'
            };
        }

        const days = this.getRemainingDays(licenseData.data.expires);
        
        if (days <= 0) {
            return {
                status: 'expired',
                statusText: 'Истекла',
                statusClass: 'status-inactive',
                icon: '❌',
                message: `Срок лицензии истек ${this.formatDate(licenseData.data.expires)}`
            };
        }

        if (days <= 7) {
            return {
                status: 'expiring',
                statusText: 'Скоро истечет',
                statusClass: 'status-pending',
                icon: '⚠️',
                message: `Лицензия истекает через ${days} дней (${this.formatDate(licenseData.data.expires)})`
            };
        }

        return {
            status: 'active',
            statusText: 'Активна',
            statusClass: 'status-active',
            icon: '✅',
            message: `Лицензия активна до ${this.formatDate(licenseData.data.expires)} (осталось ${days} дней)`
        };
    }
}

// Создаем глобальный экземпляр
const licenseManager = new LicenseManager();

// Экспортируем для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = licenseManager;
}