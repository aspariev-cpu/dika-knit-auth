// Анимация статистики
document.addEventListener('DOMContentLoaded', () => {
    // Анимированные числа
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        const target = parseInt(stat.dataset.count);
        const duration = 2000;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        
        const updateNumber = () => {
            current += increment;
            if (current >= target) {
                stat.textContent = target;
                return;
            }
            stat.textContent = Math.floor(current);
            requestAnimationFrame(updateNumber);
        };
        
        // Запускаем анимацию при появлении в поле зрения
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateNumber();
                    observer.unobserve(entry.target);
                }
            });
        });
        
        observer.observe(stat);
    });

    // Эффект скролла для навигации
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });

    // Проверка авторизации
    checkAuth();
});

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            if (data.authenticated) {
                authBtn.textContent = `👤 ${data.user.username}`;
                authBtn.href = '/dashboard.html';
            } else {
                authBtn.textContent = 'Войти';
                authBtn.href = '/login.html';
            }
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        background: ${type === 'error' ? 'rgba(255, 107, 107, 0.95)' : 'rgba(0, 184, 148, 0.95)'};
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавляем стили для уведомлений
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
`;
document.head.appendChild(notificationStyles);