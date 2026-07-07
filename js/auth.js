// ========================================
// АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // ФОРМА ВХОДА
    // ========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const remember = document.getElementById('remember')?.checked || false;
            const errorEl = document.getElementById('errorMessage');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            // Очищаем ошибки
            errorEl.classList.remove('show');
            errorEl.textContent = '';
            
            // Проверка заполнения
            if (!username || !password) {
                errorEl.textContent = 'Заполните все поля';
                errorEl.classList.add('show');
                return;
            }
            
            // Блокируем кнопку
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Вход...';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, remember })
                });
                
                const data = await response.json();
                
                if (data.success) {
    showNotification('✅ Регистрация успешна! Добро пожаловать!', 'success');
    setTimeout(() => {
        // Обычный пользователь → кабинет
        window.location.href = '/dashboard.html';
    }, 500);
}
                else {
                    errorEl.textContent = data.error || 'Ошибка входа';
                    errorEl.classList.add('show');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Войти';
                }
            } catch (error) {
                errorEl.textContent = 'Ошибка соединения с сервером';
                errorEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Войти';
                console.error('Ошибка входа:', error);
            }
        });
    }

    // ========================================
    // ФОРМА РЕГИСТРАЦИИ
    // ========================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const remember = document.getElementById('remember')?.checked || false;
            const errorEl = document.getElementById('errorMessage');
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            
            // Очищаем ошибки
            errorEl.classList.remove('show');
            errorEl.textContent = '';
            
            // Валидация
            if (!username || !email || !password || !confirmPassword) {
                errorEl.textContent = 'Заполните все поля';
                errorEl.classList.add('show');
                return;
            }
            
            if (username.length < 3) {
                errorEl.textContent = 'Имя пользователя должно быть минимум 3 символа';
                errorEl.classList.add('show');
                return;
            }
            
            if (!email.includes('@') || !email.includes('.')) {
                errorEl.textContent = 'Введите корректный email';
                errorEl.classList.add('show');
                return;
            }
            
            if (password.length < 6) {
                errorEl.textContent = 'Пароль должен быть минимум 6 символов';
                errorEl.classList.add('show');
                return;
            }
            
            if (password !== confirmPassword) {
                errorEl.textContent = 'Пароли не совпадают';
                errorEl.classList.add('show');
                return;
            }
            
            // Блокируем кнопку
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Регистрация...';
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password, remember })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('✅ Регистрация успешна! Добро пожаловать!', 'success');
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 500);
                } else {
                    errorEl.textContent = data.error || 'Ошибка регистрации';
                    errorEl.classList.add('show');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Зарегистрироваться';
                }
            } catch (error) {
                errorEl.textContent = 'Ошибка соединения с сервером. Попробуйте позже.';
                errorEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Зарегистрироваться';
                console.error('Ошибка регистрации:', error);
            }
        });
    }

    // ========================================
    // ПРОВЕРКА СЕССИИ
    // ========================================
    checkAuth();
});

// ========================================
// ФУНКЦИЯ ПРОВЕРКИ АВТОРИЗАЦИИ
// ========================================
async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        const authBtn = document.getElementById('authBtn');
        
        if (authBtn) {
            if (data.authenticated) {
                authBtn.textContent = `👤 ${data.user.username}`;
                authBtn.href = data.user.isAdmin ? '/admin-content.html' : '/dashboard.html';
                authBtn.className = 'nav-link nav-btn';
            } else {
                authBtn.textContent = 'Войти';
                authBtn.href = '/login.html';
            }
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// ========================================
// ФУНКЦИЯ УВЕДОМЛЕНИЙ
// ========================================
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.4s ease';
        setTimeout(() => notification.remove(), 400);
    }, 4000);
}