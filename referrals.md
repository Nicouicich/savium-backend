# Sistema de Referidos - Backend Implementation

## 📊 **Modelos de MongoDB**

### User Model (agregar campos)
```javascript
{
  // ... campos existentes
  referralCode: String, // username o email como código
  referredByUserId: ObjectId, // quien lo refirió
  referralCompletedAt: Date, // cuando se completó el referido
  lastActiveAt: Date, // última actividad del usuario
  activeDaysCount: Number, // días activos acumulados
}
```

### ReferralReward Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // quien recibe la recompensa
  referredUserId: ObjectId, // quien fue referido
  rewardType: String, // 'cash', 'credit', 'discount', 'bonus'
  amount: Number,
  currency: String, // default: 'USD'
  status: String, // 'pending', 'available', 'redeemed', 'expired'
  redemptionMethod: String, // 'bank_transfer', 'paypal', etc.
  redemptionDetails: Object,
  redeemedAt: Date,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### ReferralSettings Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  notificationsEnabled: Boolean, // default: true
  emailNotifications: Boolean, // default: true
  privacyMode: String, // 'public', 'friends_only', 'private'
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 **Endpoints de API**

### **Código de Referido del Usuario**

```javascript
// GET /api/v1/referral/my-code
async function getMyReferralCode(req, res) {
  const userId = req.user.id;
  const user = await User.findById(userId);
  
  const stats = await User.aggregate([
    { $match: { referredByUserId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        successfulReferrals: {
          $sum: { $cond: [{ $ne: ['$referralCompletedAt', null] }, 1, 0] }
        },
        pendingReferrals: {
          $sum: { $cond: [{ $eq: ['$referralCompletedAt', null] }, 1, 0] }
        }
      }
    }
  ]);

  res.json({
    code: user.referralCode, // username o email
    shareUrl: `${process.env.FRONTEND_URL}/signup?ref=${user.referralCode}`,
    totalReferrals: stats[0]?.totalReferrals || 0,
    successfulReferrals: stats[0]?.successfulReferrals || 0,
    pendingReferrals: stats[0]?.pendingReferrals || 0
  });
}
```

### **Aplicar Código de Referido**

```javascript
// POST /api/v1/referral/apply
async function applyReferralCode(req, res) {
  const { referralCode } = req.body;
  const userId = req.user.id;
  
  // 1. Encontrar el referrer por username o email
  const referrer = await User.findOne({
    $or: [
      { username: referralCode },
      { email: referralCode }
    ]
  });
  
  if (!referrer) {
    return res.status(400).json({ 
      success: false, 
      message: 'Código de referido inválido' 
    });
  }
  
  // 2. Validar que no se refiera a sí mismo
  if (referrer._id.toString() === userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'No puedes usar tu propio código de referido' 
    });
  }
  
  // 3. Validar que no haya sido referido antes
  const user = await User.findById(userId);
  if (user.referredByUserId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Ya fuiste referido anteriormente' 
    });
  }
  
  // 4. Aplicar referido
  await User.findByIdAndUpdate(userId, { 
    referredByUserId: referrer._id 
  });
  
  // 5. Crear recompensa pendiente
  await ReferralReward.create({
    userId: referrer._id,
    referredUserId: userId,
    rewardType: 'cash',
    amount: 10, // configurar según tu lógica
    currency: 'USD',
    status: 'pending',
    createdAt: new Date()
  });
  
  res.json({
    success: true,
    message: 'Código de referido aplicado exitosamente',
    referrerInfo: {
      name: referrer.name,
      email: referrer.email
    }
  });
}

// GET /api/v1/referral/validate/:code
async function validateReferralCode(req, res) {
  const { code } = req.params;
  
  const referrer = await User.findOne({
    $or: [
      { username: code },
      { email: code }
    ]
  });
  
  if (!referrer) {
    return res.json({ 
      valid: false, 
      message: 'Código de referido inválido' 
    });
  }
  
  res.json({
    valid: true,
    referrerInfo: {
      name: referrer.name,
      email: referrer.email
    }
  });
}
```

### **Estadísticas**

```javascript
// GET /api/v1/referral/stats
async function getReferralStats(req, res) {
  const userId = req.user.id;
  const { period = '30d' } = req.query;
  
  const dateFilter = getDateFilter(period);
  
  // Estadísticas generales
  const overview = await User.aggregate([
    { $match: { referredByUserId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        successfulReferrals: {
          $sum: { $cond: [{ $ne: ['$referralCompletedAt', null] }, 1, 0] }
        },
        pendingReferrals: {
          $sum: { $cond: [{ $eq: ['$referralCompletedAt', null] }, 1, 0] }
        }
      }
    }
  ]);
  
  // Recompensas
  const rewards = await ReferralReward.aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalRewards: { $sum: '$amount' },
        availableRewards: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, '$amount', 0] }
        }
      }
    }
  ]);
  
  // Datos del gráfico por fecha
  const chartData = await User.aggregate([
    { 
      $match: { 
        referredByUserId: new ObjectId(userId),
        createdAt: dateFilter
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        referrals: { $sum: 1 },
        conversions: {
          $sum: { $cond: [{ $ne: ['$referralCompletedAt', null] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  const stats = overview[0] || { totalReferrals: 0, successfulReferrals: 0, pendingReferrals: 0 };
  const rewardStats = rewards[0] || { totalRewards: 0, availableRewards: 0 };
  
  res.json({
    overview: {
      ...stats,
      conversionRate: stats.totalReferrals > 0 ? 
        (stats.successfulReferrals / stats.totalReferrals * 100).toFixed(2) : 0,
      ...rewardStats
    },
    chartData: chartData.map(item => ({
      date: item._id,
      referrals: item.referrals,
      conversions: item.conversions
    }))
  });
}
```

### **Historial de Referidos**

```javascript
// GET /api/v1/referral/history
async function getReferralHistory(req, res) {
  const userId = req.user.id;
  const { 
    page = 1, 
    limit = 10, 
    status, 
    search, 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query;
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  let matchConditions = { referredByUserId: new ObjectId(userId) };
  
  if (status) {
    if (status === 'completed') {
      matchConditions.referralCompletedAt = { $ne: null };
    } else if (status === 'pending') {
      matchConditions.referralCompletedAt = null;
    }
  }
  
  if (search) {
    matchConditions.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }
  
  const referrals = await User.aggregate([
    { $match: matchConditions },
    {
      $lookup: {
        from: 'referralrewards',
        localField: '_id',
        foreignField: 'referredUserId',
        as: 'reward'
      }
    },
    {
      $project: {
        id: '$_id',
        email: 1,
        name: 1,
        registeredAt: '$createdAt',
        completedAt: '$referralCompletedAt',
        status: {
          $cond: [{ $ne: ['$referralCompletedAt', null] }, 'completed', 'pending']
        },
        reward: { $arrayElemAt: ['$reward', 0] }
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: parseInt(limit) }
  ]);
  
  const total = await User.countDocuments(matchConditions);
  
  res.json({
    data: referrals,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

// GET /api/v1/referral/history/export
async function exportReferralHistory(req, res) {
  // Similar query pero sin paginación, retornar CSV
  const userId = req.user.id;
  const referrals = await User.find({ referredByUserId: userId })
    .populate('reward')
    .lean();
  
  const csv = convertToCSV(referrals);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=referral-history.csv');
  res.send(csv);
}
```

### **Recompensas**

```javascript
// GET /api/v1/referral/rewards
async function getReferralRewards(req, res) {
  const userId = req.user.id;
  const { status, page = 1, limit = 10 } = req.query;
  
  let matchConditions = { userId: new ObjectId(userId) };
  if (status) matchConditions.status = status;
  
  const rewards = await ReferralReward.aggregate([
    { $match: matchConditions },
    {
      $lookup: {
        from: 'users',
        localField: 'referredUserId',
        foreignField: '_id',
        as: 'referredUser'
      }
    },
    {
      $project: {
        id: '$_id',
        referredUser: {
          email: { $arrayElemAt: ['$referredUser.email', 0] },
          name: { $arrayElemAt: ['$referredUser.name', 0] }
        },
        amount: 1,
        currency: 1,
        type: '$rewardType',
        status: 1,
        createdAt: 1,
        redeemedAt: 1
      }
    },
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit) }
  ]);
  
  const summary = await ReferralReward.aggregate([
    { $match: { userId: new ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalAvailable: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, '$amount', 0] }
        },
        totalRedeemed: {
          $sum: { $cond: [{ $eq: ['$status', 'redeemed'] }, '$amount', 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
        }
      }
    }
  ]);
  
  res.json({
    data: rewards,
    summary: summary[0] || { totalAvailable: 0, totalRedeemed: 0, pendingAmount: 0 }
  });
}

// POST /api/v1/referral/rewards/redeem
async function redeemRewards(req, res) {
  const { rewardIds, redemptionMethod, redemptionDetails } = req.body;
  const userId = req.user.id;
  
  // Validar que todas las recompensas pertenezcan al usuario y estén disponibles
  const rewards = await ReferralReward.find({
    _id: { $in: rewardIds },
    userId: new ObjectId(userId),
    status: 'available'
  });
  
  if (rewards.length !== rewardIds.length) {
    return res.status(400).json({
      success: false,
      message: 'Algunas recompensas no están disponibles para canjear'
    });
  }
  
  const totalAmount = rewards.reduce((sum, reward) => sum + reward.amount, 0);
  
  // Actualizar recompensas a estado "redeemed"
  await ReferralReward.updateMany(
    { _id: { $in: rewardIds } },
    {
      status: 'redeemed',
      redemptionMethod,
      redemptionDetails,
      redeemedAt: new Date()
    }
  );
  
  // Aquí procesarías el pago según redemptionMethod
  // (bank_transfer, paypal, gift_card, account_credit)
  
  res.json({
    success: true,
    totalAmount,
    message: `Se canjearon $${totalAmount} exitosamente`
  });
}
```

## 🔄 **Sistema de Días Activos (Cron Job)**

```javascript
// Cron job que corre diariamente para actualizar días activos
async function updateActiveDays() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Encontrar usuarios que estuvieron activos ayer
  // (definir "activo" según tu lógica: login, transacción, etc.)
  const activeUsers = await User.find({
    lastActiveAt: {
      $gte: yesterday,
      $lt: today
    }
  });
  
  // Incrementar contador de días activos
  for (const user of activeUsers) {
    await User.findByIdAndUpdate(user._id, {
      $inc: { activeDaysCount: 1 }
    });
    
    // Verificar si completa el referido (ejemplo: 7 días activos)
    if (user.activeDaysCount + 1 >= 7 && user.referredByUserId && !user.referralCompletedAt) {
      await completeReferral(user._id);
    }
  }
}

// Función para completar referido
async function completeReferral(userId) {
  const user = await User.findById(userId);
  
  if (!user.referredByUserId || user.referralCompletedAt) return;
  
  // Marcar referido como completado
  await User.findByIdAndUpdate(userId, {
    referralCompletedAt: new Date()
  });
  
  // Activar recompensa del referrer
  await ReferralReward.findOneAndUpdate(
    {
      userId: user.referredByUserId,
      referredUserId: userId,
      status: 'pending'
    },
    {
      status: 'available'
    }
  );
  
  console.log(`Referido completado para usuario ${userId}`);
}

// Función para marcar usuario como activo (llamar en login, transacciones, etc.)
async function markUserActive(userId) {
  await User.findByIdAndUpdate(userId, {
    lastActiveAt: new Date()
  });
}
```

## 🔧 **Configuración**

```javascript
// Variables de entorno
REFERRAL_COMPLETION_DAYS=7 // días activos necesarios para completar referido
REFERRAL_REWARD_AMOUNT=10 // cantidad de recompensa por referido
REFERRAL_REWARD_CURRENCY=USD
```

## 📋 **Cómo Usar**

1. **Al registrar usuario**: Asignar `referralCode` (username o email)
2. **Al login/transacción**: Llamar `markUserActive(userId)`
3. **Cron diario**: Ejecutar `updateActiveDays()` 
4. **Frontend**: Usar endpoints para mostrar stats y gestionar referidos

El trigger de "días activos" se puede configurar según tus necesidades (7, 14, 30 días, etc.).