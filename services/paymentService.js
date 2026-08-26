const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Создать запись о платеже
 * @param {BigInt} userId - Telegram ID пользователя
 * @param {number} amount - сумма в Stars
 * @param {string} providerPaymentId - ID платежа от провайдера
 * @returns {Promise<Object>} - платеж
 */
async function createPayment(userId, amount, providerPaymentId) {
  return prisma.payment.create({
    data: {
      userId,
      amount,
      currency: 'XTR',
      status: 'completed',
      providerPaymentId
    }
  });
}

/**
 * Обновить подписку пользователя
 * @param {BigInt} userId - Telegram ID пользователя
 * @param {string} plan - тип подписки (basic/premium)
 * @returns {Promise<Object>} - обновленный пользователь
 */
async function updateSubscription(userId, plan) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return prisma.user.update({
    where: { telegramId: userId },
    data: {
      subscription: plan,
      subExpiresAt: expiresAt
    }
  });
}

/**
 * Проверить активную подписку
 * @param {Object} user - объект пользователя
 * @returns {boolean} - активна ли подписка
 */
function hasActiveSubscription(user) {
  if (user.subscription === 'free') return false;
  if (!user.subExpiresAt) return false;
  return user.subExpiresAt > new Date();
}

/**
 * Получить тип подписки
 * @param {Object} user - объект пользователя
 * @returns {string} - тип подписки
 */
function getSubscriptionType(user) {
  if (!hasActiveSubscription(user)) return 'free';
  return user.subscription;
}

module.exports = {
  createPayment,
  updateSubscription,
  hasActiveSubscription,
  getSubscriptionType
};
